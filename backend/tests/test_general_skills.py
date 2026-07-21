import base64

from fastapi import HTTPException
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select
from zipfile import ZipFile

from app.api.general_skills import (
    archive_general_skill,
    delete_general_skill,
    get_general_skill,
    import_clawhub_skill,
    import_general_skill,
    import_general_skill_package,
    list_general_skills,
    publish_general_skill,
    run_general_skill,
)
from app.agents.branching import ensure_open_gallery_binding
from app.core import AgentLoop
from app.core.reflection_agent import ReflectionDecision
from app.db.models import (
    AgentEvent,
    AgentProfile,
    AgentResourceBinding,
    ChatSession,
    GeneralSkill,
    ModelConfig,
    Skill,
    Tenant,
    User,
)
from app.general_skills.runner import GeneralSkillRunner, GeneralSkillSelector
from app.general_skills.schema import (
    GeneralSkillClawHubImportRequest,
    GeneralSkillImportRequest,
    GeneralSkillPackageUploadRequest,
    GeneralSkillRunRequest,
    GeneralSkillRunResponse,
    GeneralSkillSelection,
)
from app.llm import LLMClient, LLMError
from app.security.auth import hash_password
from app.security.encryption import encrypt_secret
from app.session.session_schema import ChatTurnRequest, RouterDecision, StepAgentResult
from app.tools.tool_schema import ToolCall


WEATHER_SKILL_MD = """# 中國城市天氣查詢工具

python weather.py -json -today <地區名稱>
"""


def _system_and_stage_instructions(system_prompt: object, payload: object) -> str:
    stage = payload.get("_agent_stage", {}) if isinstance(payload, dict) else {}
    instructions = stage.get("instructions", "") if isinstance(stage, dict) else ""
    return f"{system_prompt}\n{instructions}"


def test_capability_selector_allows_general_skill_and_knowledge_together(monkeypatch) -> None:
    monkeypatch.setattr(LLMClient, "__init__", lambda self, model_config: None)
    monkeypatch.setattr(
        LLMClient,
        "generate_json",
        lambda self, system_prompt, payload: {
            "use_general_skill": True,
            "selected_slug": "weather-zh",
            "use_knowledge": True,
            "knowledge_query": "內部出差規範對天氣風險有什麼要求",
            "confidence": 0.93,
            "reason": "需要天氣能力和內部出差規範共同回答。",
        },
    )
    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        skill_markdown=WEATHER_SKILL_MD,
        status="published",
    )

    decision = GeneralSkillSelector().decide(
        "結合天氣和公司規範給出建議", [skill], SimpleNamespace()
    )

    assert decision.use_general_skill is True
    assert decision.selected_slug == "weather-zh"
    assert decision.use_knowledge is True
    assert decision.knowledge_query == "內部出差規範對天氣風險有什麼要求"


def test_capability_selector_still_checks_knowledge_without_general_skills(monkeypatch) -> None:
    received: dict[str, object] = {}
    monkeypatch.setattr(LLMClient, "__init__", lambda self, model_config: None)

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        received.update(payload)
        return {
            "use_general_skill": False,
            "selected_slug": None,
            "use_knowledge": True,
            "knowledge_query": "員工報銷的審批要求",
            "confidence": 0.88,
            "reason": "回答依賴企業文檔。",
        }

    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    decision = GeneralSkillSelector().decide("這種費用應該怎麼報", [], SimpleNamespace())

    assert received["general_skills"] == []
    assert decision.use_general_skill is False
    assert decision.use_knowledge is True
    assert decision.knowledge_query == "員工報銷的審批要求"


def test_capability_knowledge_is_merged_into_general_skill_result() -> None:
    step_result = StepAgentResult(reply="天氣查詢完成", is_step_completed=True)
    knowledge_result = StepAgentResult(
        knowledge_query={"query": "內部出差規範"},
        knowledge_results=[{"evidence_pack": [{"content": "惡劣天氣時應調整行程"}]}],
    )

    AgentLoop._merge_capability_knowledge(step_result, knowledge_result)

    assert step_result.knowledge_query is not None
    assert step_result.knowledge_query.query == "內部出差規範"
    assert step_result.knowledge_results == knowledge_result.knowledge_results


def test_knowledge_keywords_do_not_bypass_structured_capability_selection() -> None:
    loop = object.__new__(AgentLoop)
    result = loop._auto_knowledge_step_result(  # noqa: SLF001
        ChatTurnRequest(
            tenant_id="tenant_demo",
            user_id="user_demo",
            message="請根據知識庫資料、規則、政策和文檔說明怎麼處理",
        ),
        ChatSession(id="session_demo", tenant_id="tenant_demo"),
        SimpleNamespace(),
        RouterDecision(decision="answer_only"),
        GeneralSkillSelection(
            use_general_skill=False,
            use_knowledge=False,
            reason="第二輪能力選擇認為當前上下文足以回答。",
        ),
    )

    assert result.knowledge_query is None
    assert result.knowledge_results == []


def _admin_user() -> User:
    return User(
        id="user_admin",
        tenant_id="tenant_demo",
        username="admin",
        role="admin",
        password_hash="test",
    )


def test_import_general_skill_uses_user_supplied_metadata() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        db.commit()

        first = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="用戶填寫天氣技能",
                slug="weather-zh",
                description="用戶填寫描述",
                homepage="https://example.com/weather",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )
        second = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="用戶改名天氣技能",
                slug="weather-zh",
                description="用戶改寫描述",
                homepage="https://example.com/weather-cn",
                original_slug="weather-zh",
                markdown=WEATHER_SKILL_MD.replace("中國城市天氣查詢工具", "天氣 demo"),
            ),
            db,
            _admin_user(),
        )

        rows = list_general_skills("tenant_demo", db)
        assert first.id == second.id
        assert len(rows) == 1
        assert rows[0].slug == "weather-zh"
        assert rows[0].name == "用戶改名天氣技能"
        assert rows[0].description == "用戶改寫描述"
        assert rows[0].homepage == "https://example.com/weather-cn"
        assert rows[0].skill_markdown.startswith("# 天氣 demo")

        try:
            import_general_skill(
                GeneralSkillImportRequest(
                    tenant_id="tenant_demo",
                    name="非法改 slug",
                    slug="weather-cn",
                    original_slug="weather-zh",
                    markdown=WEATHER_SKILL_MD,
                ),
                db,
                _admin_user(),
            )
            assert False, "expected general skill slug update to fail"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert exc.detail == "General skill slug cannot be modified"


def test_import_general_skill_without_original_slug_does_not_overwrite_existing() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        db.commit()

        first = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="已有天氣技能",
                slug="weather-zh",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )

        try:
            import_general_skill(
                GeneralSkillImportRequest(
                    tenant_id="tenant_demo",
                    name="新導入天氣技能",
                    slug="weather-zh",
                    markdown="# 新內容",
                ),
                db,
                _admin_user(),
            )
        except HTTPException as error:
            assert error.status_code == 409
        else:
            raise AssertionError("expected slug conflict")

        rows = list_general_skills("tenant_demo", db)
        assert len(rows) == 1
        assert rows[0].id == first.id
        assert rows[0].name == "已有天氣技能"
        assert rows[0].skill_markdown == WEATHER_SKILL_MD.strip()


def test_deleted_open_gallery_general_skill_binding_is_not_restored_by_ensure() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        db.commit()

        imported = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="天氣技能",
                slug="weather-zh",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )

        deleted = delete_general_skill(
            imported.slug,
            "tenant_demo",
            db,
            agent_id="agent_overall",
            current_user=_admin_user(),
        )
        assert deleted == {"status": "hidden", "slug": "weather-zh"}

        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", imported.id, "active")
        db.commit()

        binding = db.exec(
            select(AgentResourceBinding).where(
                AgentResourceBinding.tenant_id == "tenant_demo",
                AgentResourceBinding.agent_id == "agent_overall",
                AgentResourceBinding.resource_type == "general_skill",
                AgentResourceBinding.resource_id == imported.id,
            )
        ).one()
        assert binding.status == "deleted"
        assert list_general_skills("tenant_demo", db) == []


def test_deleted_open_gallery_general_skill_is_hidden_from_agent_branch_binding() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        db.add(
            AgentProfile(
                id="agent_branch", tenant_id="tenant_demo", name="研發員工", is_overall=False
            )
        )
        db.commit()

        imported = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="天氣技能",
                slug="weather-zh",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )
        db.add(
            AgentResourceBinding(
                tenant_id="tenant_demo",
                agent_id="agent_branch",
                resource_type="general_skill",
                resource_id=imported.id,
                status="active",
            )
        )
        db.commit()
        assert [
            row.id for row in list_general_skills("tenant_demo", db, agent_id="agent_branch")
        ] == [imported.id]

        deleted = delete_general_skill(
            imported.slug,
            "tenant_demo",
            db,
            agent_id="agent_overall",
            current_user=_admin_user(),
        )
        assert deleted == {"status": "hidden", "slug": "weather-zh"}

        assert list_general_skills("tenant_demo", db, agent_id="agent_branch") == []
        assert AgentLoop(db)._list_published_general_skills("tenant_demo", "agent_branch") == []


def test_import_general_skill_folder_reads_skill_md_metadata() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)

        row = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                files=[
                    {
                        "path": "weather-bundle/SKILL.md",
                        "content": (
                            "---\n"
                            "name: 中國城市天氣\n"
                            "slug: weather-zh\n"
                            "description: 從目錄包讀取天氣技能\n"
                            "homepage: https://example.com/weather\n"
                            "---\n\n"
                            "# 使用說明\n"
                            "讀取 data/cities.json 完成查詢。\n"
                        ),
                    },
                    {
                        "path": "weather-bundle/data/cities.json",
                        "content": '{"北京": "101010100"}',
                    },
                ],
            ),
            db,
            _admin_user(),
        )

        assert row.name == "中國城市天氣"
        assert row.slug == "weather-zh"
        assert row.description == "從目錄包讀取天氣技能"
        assert row.homepage == "https://example.com/weather"
        assert row.metadata["name"] == "中國城市天氣"
        assert [file.path for file in row.skill_files] == ["SKILL.md", "data/cities.json"]
        assert row.skill_markdown.startswith("---\nname: 中國城市天氣")


def test_import_clawhub_skill_reads_zip_package_without_overwriting(monkeypatch) -> None:
    package = BytesIO()
    with ZipFile(package, "w") as archive:
        archive.writestr(
            "skill-pack-main/weather/SKILL.md",
            "---\nname: 天氣包\nslug: weather-pack\n---\n\n# 天氣包\n",
        )
        archive.writestr("skill-pack-main/weather/scripts/run.py", "print('ok')\n")
        archive.writestr("skill-pack-main/weather/data/cities.json", '{"北京": "101010100"}')

    def fake_download(url: str):  # noqa: ANN001
        assert url == "https://example.com/weather.zip"
        return package.getvalue(), "application/zip"

    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        first = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(
                tenant_id="tenant_demo", source="https://example.com/weather.zip"
            ),
            db,
            _admin_user(),
        )
        second = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(
                tenant_id="tenant_demo", source="https://example.com/weather.zip"
            ),
            db,
            _admin_user(),
        )

        assert first.slug == "weather-pack"
        assert second.slug == "weather-pack-2"
        assert [file.path for file in first.skill_files] == [
            "SKILL.md",
            "scripts/run.py",
            "data/cities.json",
        ]
        assert first.skill_markdown.startswith("---\nname: 天氣包")


def test_import_general_skill_package_upload_keeps_full_zip_folder() -> None:
    package = BytesIO()
    with ZipFile(package, "w") as archive:
        archive.writestr(
            "nuwa-skill-main/skill/SKILL.md",
            "---\nname: Nuwa Skill\nslug: nuwa-skill\n---\n\n# Nuwa Skill\n",
        )
        archive.writestr("nuwa-skill-main/skill/scripts/run.py", "print('nuwa')\n")
        archive.writestr("nuwa-skill-main/skill/assets/config.json", '{"mode":"demo"}')

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_general_skill_package(
            GeneralSkillPackageUploadRequest(
                tenant_id="tenant_demo",
                filename="nuwa-skill.zip",
                content_base64=base64.b64encode(package.getvalue()).decode("ascii"),
                status="published",
            ),
            db,
            _admin_user(),
        )

        assert row.slug == "nuwa-skill"
        assert row.name == "Nuwa Skill"
        assert [file.path for file in row.skill_files] == [
            "SKILL.md",
            "scripts/run.py",
            "assets/config.json",
        ]
        assert row.skill_markdown.startswith("---\nname: Nuwa Skill")


def test_import_general_skill_package_upload_treats_single_markdown_as_skill_md() -> None:
    markdown = "---\nname: 單文件技能\nslug: single-file-skill\n---\n\n# 單文件技能\n"

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_general_skill_package(
            GeneralSkillPackageUploadRequest(
                tenant_id="tenant_demo",
                filename="readme.md",
                content_base64=base64.b64encode(markdown.encode("utf-8")).decode("ascii"),
                status="published",
            ),
            db,
            _admin_user(),
        )

        assert row.slug == "single-file-skill"
        assert [file.path for file in row.skill_files] == ["SKILL.md"]


def test_import_clawhub_skill_reads_github_directory_package(monkeypatch) -> None:
    def fake_json(url: str):  # noqa: ANN001
        if url == "https://api.github.com/repos/example/skill-pack/contents/weather?ref=main":
            return [
                {
                    "type": "file",
                    "path": "weather/SKILL.md",
                    "download_url": "https://raw.githubusercontent.com/example/skill-pack/main/weather/SKILL.md",
                    "size": 46,
                },
                {
                    "type": "dir",
                    "path": "weather/scripts",
                },
                {
                    "type": "file",
                    "path": "weather/data/cities.json",
                    "download_url": "https://raw.githubusercontent.com/example/skill-pack/main/weather/data/cities.json",
                    "size": 24,
                },
            ]
        if (
            url
            == "https://api.github.com/repos/example/skill-pack/contents/weather/scripts?ref=main"
        ):
            return [
                {
                    "type": "file",
                    "path": "weather/scripts/run.py",
                    "download_url": "https://raw.githubusercontent.com/example/skill-pack/main/weather/scripts/run.py",
                    "size": 12,
                }
            ]
        raise AssertionError(f"unexpected github api url: {url}")

    def fake_download(url: str):  # noqa: ANN001
        content = {
            "https://raw.githubusercontent.com/example/skill-pack/main/weather/SKILL.md": "---\nname: 目錄天氣\nslug: weather-dir\n---\n\n# 天氣\n",
            "https://raw.githubusercontent.com/example/skill-pack/main/weather/scripts/run.py": "print('ok')\n",
            "https://raw.githubusercontent.com/example/skill-pack/main/weather/data/cities.json": '{"北京":"101010100"}',
        }.get(url)
        if content is None:
            raise AssertionError(f"unexpected raw url: {url}")
        return content.encode("utf-8"), "text/plain"

    monkeypatch.setattr("app.api.general_skills._download_json", fake_json)
    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(
                tenant_id="tenant_demo",
                source="https://github.com/example/skill-pack/tree/main/weather",
            ),
            db,
            _admin_user(),
        )

        assert row.slug == "weather-dir"
        assert [file.path for file in row.skill_files] == [
            "SKILL.md",
            "scripts/run.py",
            "data/cities.json",
        ]
        assert row.skill_files[1].content == "print('ok')\n"


def test_import_clawhub_skill_follows_page_to_real_skill_package(monkeypatch) -> None:
    def fake_download(url: str):  # noqa: ANN001
        if url == "https://clawhub.example/skills/weather":
            return (
                b'<html><a href="https://github.com/example/skill-pack/tree/main/weather">download</a></html>',
                "text/html",
            )
        content = {
            "https://raw.githubusercontent.com/example/skill-pack/main/weather/SKILL.md": "---\nname: 頁面天氣\nslug: weather-page\n---\n\n# 天氣\n",
        }.get(url)
        if content is None:
            raise AssertionError(f"unexpected url: {url}")
        return content.encode("utf-8"), "text/plain"

    def fake_json(url: str):  # noqa: ANN001
        assert url == "https://api.github.com/repos/example/skill-pack/contents/weather?ref=main"
        return [
            {
                "type": "file",
                "path": "weather/SKILL.md",
                "download_url": "https://raw.githubusercontent.com/example/skill-pack/main/weather/SKILL.md",
                "size": 46,
            }
        ]

    monkeypatch.setattr("app.api.general_skills._download_json", fake_json)
    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(
                tenant_id="tenant_demo", source="https://clawhub.example/skills/weather"
            ),
            db,
            _admin_user(),
        )

        assert row.slug == "weather-page"
        assert row.skill_files[0].path == "SKILL.md"


def test_import_clawhub_skill_uses_clawhub_download_api_for_page_url(monkeypatch) -> None:
    package = BytesIO()
    with ZipFile(package, "w") as archive:
        archive.writestr(
            "SKILL.md",
            "---\nname: weather\n---\n\n# 天氣\n",
        )
        archive.writestr("scripts/weather.py", "print('weather')\n")
        archive.writestr("references/weather_details.md", "# details\n")

    calls: list[str] = []

    def fake_download(url: str):  # noqa: ANN001
        calls.append(url)
        assert url == "https://wry-manatee-359.convex.site/api/v1/download?slug=maomao-weather"
        return package.getvalue(), "application/zip"

    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(
                tenant_id="tenant_demo",
                source="https://clawhub.ai/maomaoshuo/maomao-weather",
            ),
            db,
            _admin_user(),
        )

        assert calls == ["https://wry-manatee-359.convex.site/api/v1/download?slug=maomao-weather"]
        assert row.name == "weather"
        assert row.slug == "maomao-weather"
        assert row.homepage == "https://clawhub.ai/maomaoshuo/maomao-weather"
        assert [file.path for file in row.skill_files] == [
            "SKILL.md",
            "scripts/weather.py",
            "references/weather_details.md",
        ]


def test_import_clawhub_skill_accepts_cli_slug(monkeypatch) -> None:
    package = BytesIO()
    with ZipFile(package, "w") as archive:
        archive.writestr("SKILL.md", "---\nname: weather\n---\n\n# 天氣\n")

    def fake_download(url: str):  # noqa: ANN001
        assert url == "https://wry-manatee-359.convex.site/api/v1/download?slug=maomao-weather"
        return package.getvalue(), "application/zip"

    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        row = import_clawhub_skill(
            GeneralSkillClawHubImportRequest(tenant_id="tenant_demo", source="maomao-weather"),
            db,
            _admin_user(),
        )

        assert row.slug == "maomao-weather"
        assert row.skill_files[0].content.startswith("---\nname: weather")


def test_import_clawhub_skill_rejects_plain_html_page(monkeypatch) -> None:
    def fake_download(url: str):  # noqa: ANN001
        assert url == "https://clawhub.example/skills/weather"
        return b"<html><body>skill landing page without package</body></html>", "text/html"

    monkeypatch.setattr("app.api.general_skills._download_url", fake_download)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        try:
            import_clawhub_skill(
                GeneralSkillClawHubImportRequest(
                    tenant_id="tenant_demo", source="https://clawhub.example/skills/weather"
                ),
                db,
                _admin_user(),
            )
        except HTTPException as error:
            assert error.status_code == 400
            assert "HTML 頁面不會被當作 SKILL.md 導入" in str(error.detail)
        else:
            raise AssertionError("plain HTML page must not be imported as SKILL.md")


def test_general_skill_archive_publish_and_delete_api(monkeypatch) -> None:
    captured_model_ids: list[str] = []

    def fake_run(
        self, skill, query, model_config, user_id="enterprise_demo", max_attempts=5, event_sink=None
    ):  # noqa: ANN001
        captured_model_ids.append(model_config.id)
        return {
            "skill_slug": skill.slug,
            "execution_trace": [],
            "generated_code": "",
            "stdout": "",
            "stderr": "",
            "structured_result": {"success": True},
            "reply": f"{query} ok",
        }

    monkeypatch.setattr(GeneralSkillRunner, "run", fake_run)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="開放廣場", is_overall=True
            )
        )
        db.add(
            ModelConfig(
                id="model_selected",
                tenant_id="tenant_demo",
                name="Selected model",
                api_key_encrypted=encrypt_secret("selected-key"),
                model="selected",
                enabled=True,
            )
        )
        db.commit()
        imported = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="天氣",
                slug="weather-zh",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )

        archived = archive_general_skill(
            imported.slug, "tenant_demo", db, current_user=_admin_user()
        )
        assert archived.status == "archived"
        try:
            run_general_skill(
                imported.slug,
                GeneralSkillRunRequest(
                    tenant_id="tenant_demo", user_id="user_demo", query="北京天氣"
                ),
                db,
                _admin_user(),
            )
        except HTTPException as error:
            assert error.status_code == 400
            assert "not published" in str(error.detail)
        else:
            raise AssertionError("archived general skill should not run")

        published = publish_general_skill(
            imported.slug, "tenant_demo", db, current_user=_admin_user()
        )
        assert published.status == "published"
        result = run_general_skill(
            imported.slug,
            GeneralSkillRunRequest(tenant_id="tenant_demo", user_id="user_demo", query="北京天氣"),
            db,
            _admin_user(),
        )
        assert result["reply"] == "北京天氣 ok"

        selected_result = run_general_skill(
            imported.slug,
            GeneralSkillRunRequest(
                tenant_id="tenant_demo",
                user_id="user_demo",
                query="上海天氣",
                model_config_id="model_selected",
            ),
            db,
            _admin_user(),
        )
        assert selected_result["reply"] == "上海天氣 ok"
        assert captured_model_ids[-1] == "model_selected"

        deleted = delete_general_skill(
            imported.slug,
            "tenant_demo",
            db,
            agent_id="agent_overall",
            current_user=_admin_user(),
        )
        assert deleted == {"status": "hidden", "slug": "weather-zh"}
        assert list_general_skills("tenant_demo", db) == []
        try:
            get_general_skill(imported.slug, "tenant_demo", db)
        except HTTPException as error:
            assert error.status_code == 404
        else:
            raise AssertionError("deleted general skill should be gone")


def test_non_overall_agent_delete_hides_general_skill_only_in_branch() -> None:
    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        db.add(
            AgentProfile(
                id="agent_branch", tenant_id="tenant_demo", name="客服分支", is_overall=False
            )
        )
        imported = import_general_skill(
            GeneralSkillImportRequest(
                tenant_id="tenant_demo",
                name="天氣",
                slug="weather-zh",
                markdown=WEATHER_SKILL_MD,
            ),
            db,
            _admin_user(),
        )
        db.commit()

        deleted = delete_general_skill(
            imported.slug,
            "tenant_demo",
            db,
            agent_id="agent_branch",
            current_user=_admin_user(),
        )

        assert deleted == {"status": "hidden", "slug": "weather-zh"}
        assert get_general_skill(imported.slug, "tenant_demo", db).slug == "weather-zh"
        assert list_general_skills("tenant_demo", db, agent_id="agent_branch") == []
        assert (
            list_general_skills("tenant_demo", db, agent_id="agent_overall")[0].slug == "weather-zh"
        )


def test_chat_turn_uses_general_skill_after_scene_router_skips_unmatched_scene(
    monkeypatch,
) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "企業技能路由器" in prompt_text:
            calls.append("router")
            return {
                "decision": "clarify",
                "target_skill_id": "skill_weather_query",
                "target_step_id": "step_query_weather",
                "confidence": 0.85,
                "user_intent": "查詢海淀區天氣",
                "reason": "模型錯誤地假設存在天氣流程。",
            }
        if "通用技能選擇器" in prompt_text:
            calls.append("selector")
            return {
                "use_general_skill": True,
                "selected_slug": "weather-zh",
                "confidence": 0.96,
                "reason": "用戶詢問天氣。",
            }
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            code = (
                "import json\n"
                "payload=json.loads(input())\n"
                "print(json.dumps({'success': True, 'city': '海淀區', 'weather': '晴', 'query': payload['query']}, ensure_ascii=False))\n"
            )
            return {"code": code, "rationale": "天氣查詢 demo"}
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["weather"] == "晴"
            return {"reply": "海淀區今天晴。"}
        if "企業技能執行助手" in prompt_text:
            raise AssertionError("step agent should not run without an active scene skill")
        raise AssertionError("unexpected JSON prompt")

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        calls.append("response")
        assert payload["current_step"] is None
        assert payload["slots"] == {}
        assert payload["tool_result"]["tool_name"] == "general_skill.weather-zh"
        assert payload["tool_result"]["success"] is True
        assert payload["tool_result"]["data"]["structured_result"]["weather"] == "晴"
        assert payload["step_summary"]["reply"] == "海淀區今天晴。"
        return "海淀區今天晴。"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        scene_skill = _purchase_scene_skill()
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            homepage="https://www.weather.com.cn/",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(scene_skill)
        db.add(general_skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", scene_skill.id, "active")
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.commit()

        response = AgentLoop(db).handle_turn(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                user_id="user_demo",
                message="我想看下海淀區的天氣",
            )
        )

        assert response.reply == "海淀區今天晴。"
        assert calls == ["router", "selector", "runner", "reply", "response"]
        assert response.tool_result is not None
        assert response.tool_result.tool_name == "general_skill.weather-zh"
        assert response.router_decision is not None
        assert response.router_decision.target_skill_id is None
        events = db.exec(
            select(AgentEvent).where(AgentEvent.session_id == response.session_id)
        ).all()
        event_types = {event.event_type for event in events}
        assert "general_skill_selected" in event_types
        assert "tool_call_started" not in event_types
        assert "step_agent_result_created" not in event_types


def test_general_skill_response_keeps_active_scene_context(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "企業技能路由器" in prompt_text:
            calls.append("router")
            return {
                "decision": "answer_only",
                "confidence": 0.9,
                "user_intent": "購買流程中插入天氣查詢",
                "reason": "用戶在購買流程中詢問天氣，需要先回答相關問題。",
            }
        if "通用技能選擇器" in prompt_text:
            calls.append("selector")
            return {
                "use_general_skill": True,
                "selected_slug": "weather-zh",
                "confidence": 0.96,
                "reason": "用戶詢問海淀天氣。",
            }
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            code = (
                "import json\n"
                "payload=json.loads(input())\n"
                "print(json.dumps({'success': True, 'city': '海淀', 'weather': '晴', 'query': payload['query']}, ensure_ascii=False))\n"
            )
            return {"code": code, "rationale": "天氣查詢 demo"}
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["city"] == "海淀"
            return {"reply": "海淀當前天氣晴。"}
        if "企業技能執行助手" in prompt_text:
            raise AssertionError(
                "scene step agent should not run for inserted general skill answer"
            )
        raise AssertionError("unexpected JSON prompt")

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        calls.append("response")
        assert payload["current_step"]["node_id"] == "collect_product"
        assert payload["slots"]["user_name"] == "hm"
        assert payload["tool_result"]["tool_name"] == "general_skill.weather-zh"
        assert payload["tool_result"]["data"]["reply"] == "海淀當前天氣晴。"
        return "海淀當前天氣晴。天氣合適的話，請繼續告訴我想購買的商品和數量。"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        scene_skill = _purchase_scene_skill()
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            homepage="https://www.weather.com.cn/",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(scene_skill)
        db.add(general_skill)
        db.add(
            ChatSession(
                id="session_weather_inside_purchase",
                tenant_id="tenant_demo",
                user_id="user_demo",
                active_skill_id="purchase",
                active_step_id="collect_product",
                slots_json={"user_name": "hm"},
            )
        )
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", scene_skill.id, "active")
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.commit()

        response = AgentLoop(db).handle_turn(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                session_id="session_weather_inside_purchase",
                user_id="user_demo",
                message="誒？現在海淀天氣怎麼樣，天氣好我就出門買了",
            )
        )

        assert response.reply == "海淀當前天氣晴。天氣合適的話，請繼續告訴我想購買的商品和數量。"
        assert response.tool_result is not None
        assert response.session_state.active_skill_id == "purchase"
        assert response.session_state.active_step_id == "collect_product"
        assert calls == ["router", "selector", "runner", "reply", "response"]


def test_general_skill_and_active_scene_run_in_the_same_turn(monkeypatch) -> None:
    selector_calls: list[str] = []
    runner_calls: list[str] = []
    step_calls: list[list[str]] = []

    with _test_session() as db:
        _seed_minimal_tenant(db)
        overall_agent = AgentProfile(
            id="agent_overall_scene_and_general",
            tenant_id="tenant_demo",
            name="開放廣場",
            is_overall=True,
        )
        scene_skill = _purchase_scene_skill()
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        chat_session = ChatSession(
            id="session_scene_and_general",
            tenant_id="tenant_demo",
            user_id="user_demo",
            agent_id=overall_agent.id,
            active_skill_id="purchase",
            active_step_id="collect_product",
            slots_json={"product_id": "a1"},
        )
        db.add(overall_agent)
        db.add(scene_skill)
        db.add(general_skill)
        db.add(chat_session)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", scene_skill.id, "active")
        ensure_open_gallery_binding(
            db, "tenant_demo", "general_skill", general_skill.id, "active"
        )
        db.commit()

        loop = AgentLoop(db)

        def fake_select(  # noqa: ANN001
            query,
            general_skills,
            model_config,
            conversation_context=None,
            memory_context=None,
        ):
            selector_calls.append(query)
            return GeneralSkillSelection(
                use_general_skill=True,
                selected_slug="weather-zh",
                confidence=0.98,
                reason="用戶同時要求查詢北京天氣。",
            )

        def fake_general_run(  # noqa: ANN001
            skill,
            query,
            model_config,
            user_id="",
            max_attempts=10,
            event_sink=None,
            conversation_context=None,
            memory_context=None,
        ):
            runner_calls.append(query)
            return GeneralSkillRunResponse(
                skill_slug=skill.slug,
                execution_trace=[],
                generated_code="",
                stdout="",
                stderr="",
                structured_result={"success": True, "city": "北京", "weather": "晴"},
                reply="北京當前天氣晴。",
            )

        def fake_step_run(**kwargs):  # noqa: ANN003
            step_calls.append([tool.name for tool in kwargs["tools"]])
            assert kwargs["repair_context"]["reason"] == "tool_continuation"
            assert kwargs["repair_context"]["previous_tool_result"]["success"] is True
            return StepAgentResult(
                action="ask_user",
                reply="北京當前天氣晴。請問您想購買多少數量的 a1？",
                slot_updates={"product_id": "a1"},
            )

        monkeypatch.setattr(loop.general_skill_selector, "decide", fake_select)
        monkeypatch.setattr(loop.general_skill_runner, "run", fake_general_run)
        monkeypatch.setattr(loop.step_agent, "run", fake_step_run)

        model_config = db.exec(
            select(ModelConfig).where(ModelConfig.tenant_id == "tenant_demo")
        ).first()
        request = ChatTurnRequest(
            tenant_id="tenant_demo",
            session_id=chat_session.id,
            user_id="user_demo",
            message="我想買 a1，同時幫我看下北京天氣",
        )
        router_decision = RouterDecision(
            decision="continue_active",
            target_skill_id="purchase",
            user_intent="購買 a1 並查詢北京天氣",
            general_intent="查詢北京天氣",
        )
        tools = loop._tools_with_general_skills(
            "tenant_demo", [], overall_agent.id
        )

        initial_result = loop._run_step_agent_with_context_repair(
            request,
            chat_session,
            scene_skill,
            tools,
            model_config,
            router_decision,
            [],
            {"messages": [{"role": "user", "content": request.message}]},
            [],
        )
        final_result, tool_result = loop._execute_tool_action_cycle(
            request,
            chat_session,
            scene_skill,
            tools,
            model_config,
            initial_result,
            conversation_context={
                "messages": [{"role": "user", "content": request.message}]
            },
            memory_context=[],
        )

        assert initial_result.tool_call == ToolCall(
            name="general_skill.weather-zh",
            arguments={"query": "查詢北京天氣"},
        )
        assert tool_result is not None and tool_result.success is True
        assert final_result.reply == "北京當前天氣晴。請問您想購買多少數量的 a1？"
        assert chat_session.active_skill_id == "purchase"
        assert chat_session.active_step_id == "collect_product"
        assert selector_calls == ["查詢北京天氣"]
        assert runner_calls == ["查詢北京天氣"]
        assert step_calls == [[]]
        event_types = {
            event.event_type
            for event in db.exec(
                select(AgentEvent).where(AgentEvent.session_id == chat_session.id)
            ).all()
        }
        assert "general_skill_selected" in event_types
        assert "tool_call_finished" in event_types


def test_scene_tool_call_to_general_skill_records_expandable_trace(monkeypatch) -> None:
    received_contexts: list[object] = []

    def fake_decide(  # noqa: ANN001
        self,
        query,
        general_skills,
        model_config,
        conversation_context=None,
        memory_context=None,
    ):
        received_contexts.append(conversation_context)
        return GeneralSkillSelection(
            use_general_skill=True,
            selected_slug="weather-zh",
            confidence=0.95,
            reason="天氣查詢與天氣技能匹配。",
        )

    def fake_run(  # noqa: ANN001
        self,
        skill,
        query,
        model_config,
        user_id="",
        max_attempts=10,
        event_sink=None,
        conversation_context=None,
        memory_context=None,
    ):
        received_contexts.append(conversation_context)
        trace = [
            {"phase": "skill_loaded", "message": "已加載通用技能 中國城市天氣", "slug": skill.slug},
            {
                "phase": "plan_created",
                "message": "已生成 Python runner",
                "runtime": "python",
                "code": "import json\nprint(json.dumps({'success': True, 'city': '北京'}, ensure_ascii=False))\n",
                "rationale": "查詢天氣。",
            },
            {"phase": "attempt_started", "message": "開始第 1 次運行", "attempt": 1},
            {"phase": "stdout_chunk", "text": '{"success": true, "city": "北京"}'},
            {"phase": "reflection_passed", "message": "第 1 次運行結果可用", "attempt": 1},
            {"phase": "reply_created", "message": "已生成最終回覆"},
        ]
        if event_sink:
            for item in trace:
                event_sink(item)
        return GeneralSkillRunResponse(
            skill_slug=skill.slug,
            execution_trace=trace,
            generated_code=trace[1]["code"],
            stdout='{"success": true, "city": "北京"}',
            stderr="",
            structured_result={"success": True, "city": "北京"},
            reply="北京天氣已查詢。",
        )

    monkeypatch.setattr(GeneralSkillSelector, "decide", fake_decide)
    monkeypatch.setattr(GeneralSkillRunner, "run", fake_run)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall_tool_trace",
                tenant_id="tenant_demo",
                name="開放廣場",
                is_overall=True,
            )
        )
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(general_skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.add(
            ChatSession(
                id="session_general_skill_tool",
                tenant_id="tenant_demo",
                user_id="user_demo",
                active_skill_id="purchase",
                active_step_id="collect_product",
            )
        )
        db.commit()

        stream_events: list[tuple[str, dict[str, object]]] = []
        conversation_context = {"messages": [{"role": "user", "content": "北京天氣怎麼樣"}]}
        result = AgentLoop(db)._execute_tool_call(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                session_id="session_general_skill_tool",
                user_id="user_demo",
                message="北京天氣怎麼樣",
            ),
            db.get(ChatSession, "session_general_skill_tool"),
            ToolCall(name="general_skill.weather-zh", arguments={"query": "北京天氣怎麼樣"}),
            tool_call_id="toolcall_weather",
            stream_events=stream_events,
            conversation_context=conversation_context,
        )

        assert result.success is True
        assert result.data["generated_code"].startswith("import json")
        rows = db.exec(
            select(AgentEvent).where(AgentEvent.session_id == "session_general_skill_tool")
        ).all()
        event_types = [row.event_type for row in rows]
        assert event_types[0] == "tool_call_started"
        assert "general_skill_trace" in event_types
        assert "general_skill_run_finished" in event_types
        assert event_types[-1] == "tool_call_finished"
        trace_payloads = [
            row.payload_json for row in rows if row.event_type == "general_skill_trace"
        ]
        assert any(
            payload.get("phase") == "plan_created" and "import json" in str(payload.get("code"))
            for payload in trace_payloads
        )
        assert any(payload.get("phase") == "stdout_chunk" for payload in trace_payloads)
        assert [name for name, _payload in stream_events].count("general_skill_trace") == len(
            trace_payloads
        )
        assert any(name == "general_skill_run_finished" for name, _payload in stream_events)
        assert received_contexts == [conversation_context, conversation_context]


def test_scene_tool_call_to_general_skill_backfills_returned_trace(monkeypatch) -> None:
    def fake_decide(  # noqa: ANN001
        self,
        query,
        general_skills,
        model_config,
        conversation_context=None,
        memory_context=None,
    ):
        return GeneralSkillSelection(
            use_general_skill=True,
            selected_slug="weather-zh",
            confidence=0.95,
            reason="天氣查詢與天氣技能匹配。",
        )

    def fake_run(  # noqa: ANN001
        self,
        skill,
        query,
        model_config,
        user_id="",
        max_attempts=10,
        event_sink=None,
        conversation_context=None,
        memory_context=None,
    ):
        trace = [
            {"phase": "skill_loaded", "message": "已加載通用技能 中國城市天氣", "slug": skill.slug},
            {
                "phase": "plan_created",
                "message": "已生成 Python runner",
                "runtime": "python",
                "code": "print('ok')\n",
            },
            {"phase": "stdout_chunk", "text": "ok"},
            {"phase": "reply_created", "message": "已生成最終回覆"},
        ]
        return GeneralSkillRunResponse(
            skill_slug=skill.slug,
            execution_trace=trace,
            generated_code=trace[1]["code"],
            stdout="ok",
            stderr="",
            structured_result={"success": True},
            reply="北京天氣已查詢。",
        )

    monkeypatch.setattr(GeneralSkillSelector, "decide", fake_decide)
    monkeypatch.setattr(GeneralSkillRunner, "run", fake_run)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall_tool_backfill",
                tenant_id="tenant_demo",
                name="開放廣場",
                is_overall=True,
            )
        )
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(general_skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.add(
            ChatSession(
                id="session_general_skill_tool_backfill",
                tenant_id="tenant_demo",
                user_id="user_demo",
                active_skill_id="purchase",
                active_step_id="collect_product",
            )
        )
        db.commit()

        stream_events: list[tuple[str, dict[str, object]]] = []
        result = AgentLoop(db)._execute_tool_call(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                session_id="session_general_skill_tool_backfill",
                user_id="user_demo",
                message="北京天氣怎麼樣",
            ),
            db.get(ChatSession, "session_general_skill_tool_backfill"),
            ToolCall(name="general_skill.weather-zh", arguments={"query": "北京天氣怎麼樣"}),
            tool_call_id="toolcall_weather_backfill",
            stream_events=stream_events,
        )

        assert result.success is True
        rows = db.exec(
            select(AgentEvent).where(AgentEvent.session_id == "session_general_skill_tool_backfill")
        ).all()
        trace_payloads = [
            row.payload_json for row in rows if row.event_type == "general_skill_trace"
        ]
        assert [payload.get("phase") for payload in trace_payloads] == [
            "skill_loaded",
            "plan_created",
            "stdout_chunk",
            "reply_created",
        ]
        assert [name for name, _payload in stream_events].count("general_skill_trace") == len(
            trace_payloads
        )


def test_scene_tool_call_rejects_mismatched_general_skill(monkeypatch) -> None:
    runner_calls: list[str] = []

    def fake_decide(  # noqa: ANN001
        self,
        query,
        general_skills,
        model_config,
        conversation_context=None,
        memory_context=None,
    ):
        return GeneralSkillSelection(
            use_general_skill=False,
            selected_slug=None,
            confidence=0.12,
            reason="商品價格查詢不屬於候選通用技能能力。",
        )

    def fake_run(  # noqa: ANN001
        self,
        skill,
        query,
        model_config,
        user_id="",
        max_attempts=10,
        event_sink=None,
        conversation_context=None,
        memory_context=None,
    ):
        runner_calls.append(query)
        return GeneralSkillRunResponse(
            skill_slug=skill.slug,
            execution_trace=[],
            generated_code="",
            stdout="",
            stderr="",
            structured_result={"success": True},
            reply="不應執行。",
        )

    monkeypatch.setattr(GeneralSkillSelector, "decide", fake_decide)
    monkeypatch.setattr(GeneralSkillRunner, "run", fake_run)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall_tool_mismatch",
                tenant_id="tenant_demo",
                name="開放廣場",
                is_overall=True,
            )
        )
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(general_skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.add(
            ChatSession(
                id="session_general_skill_mismatch",
                tenant_id="tenant_demo",
                user_id="user_demo",
                active_skill_id="purchase",
                active_step_id="collect_product",
            )
        )
        db.commit()

        result = AgentLoop(db)._execute_tool_call(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                session_id="session_general_skill_mismatch",
                user_id="user_demo",
                message="查詢商品 A1 和 A3 的當前實時價格",
            ),
            db.get(ChatSession, "session_general_skill_mismatch"),
            ToolCall(
                name="general_skill.weather-zh",
                arguments={"query": "查詢商品 A1 和 A3 的當前實時價格"},
            ),
            tool_call_id="toolcall_weather_mismatch",
        )

        assert result.success is False
        assert result.error is not None
        assert result.error.code == "GENERAL_SKILL_MISMATCH"
        assert runner_calls == []
        rows = db.exec(
            select(AgentEvent).where(AgentEvent.session_id == "session_general_skill_mismatch")
        ).all()
        assert any(row.event_type == "general_skill_guard_rejected" for row in rows)


def test_scene_step_agent_does_not_expose_irrelevant_general_skill(monkeypatch) -> None:
    def fake_decide(  # noqa: ANN001
        self,
        query,
        general_skills,
        model_config,
        conversation_context=None,
        memory_context=None,
    ):
        return GeneralSkillSelection(
            use_general_skill=False,
            selected_slug=None,
            confidence=0.08,
            reason="商品價格查詢不屬於天氣通用技能。",
        )

    monkeypatch.setattr(GeneralSkillSelector, "decide", fake_decide)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            GeneralSkill(
                tenant_id="tenant_demo",
                slug="weather-zh",
                name="中國城市天氣",
                description="中國城市天氣查詢工具",
                skill_markdown=WEATHER_SKILL_MD,
                status="published",
            )
        )
        db.commit()

        model_config = db.exec(
            select(ModelConfig).where(ModelConfig.tenant_id == "tenant_demo")
        ).first()
        active_skill = Skill(
            tenant_id="tenant_demo",
            skill_id="after_sales_refund",
            name="售後退款流程",
            status="published",
            content_json={},
        )
        tools = [
            SimpleNamespace(
                enabled=True, name="order.query", allowed_skills_json=["after_sales_refund"]
            ),
            SimpleNamespace(enabled=True, name="general_skill.weather-zh", allowed_skills_json=[]),
        ]

        scoped = AgentLoop(db)._step_agent_tools(
            active_skill,
            tools,
            "查詢商品 'a' 的價格",
            model_config,
        )

        assert scoped == []


def test_reflection_can_retry_general_skill_with_user_query() -> None:
    loop = AgentLoop.__new__(AgentLoop)
    tool_call = loop._tool_call_from_reflection(
        ReflectionDecision(
            action="retry_tool",
            needs_retry=True,
            target_tool_name="general_skill.weather-zh",
            reason="場景內臨時查詢需要通用技能執行。",
        ),
        ChatSession(
            id="session_reflection_general_skill",
            tenant_id="tenant_demo",
            user_id="user_demo",
            active_skill_id="skill_purchase_001",
            active_step_id="collect_user_name",
            slots_json={"user_name": "hm", "product_id": "A1"},
        ),
        [
            SimpleNamespace(
                enabled=True,
                name="general_skill.weather-zh",
                input_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
            )
        ],
        "我想買個 A1，同時查一下海淀天氣",
    )

    assert tool_call == ToolCall(
        name="general_skill.weather-zh",
        arguments={"query": "我想買個 A1，同時查一下海淀天氣"},
    )


def test_scene_layer_prompt_contract_mentions_general_skill_tools() -> None:
    prompt_dir = Path(__file__).resolve().parents[1] / "app" / "llm" / "prompts"

    router_prompt = (prompt_dir / "router_prompt.md").read_text(encoding="utf-8")
    step_prompt = (prompt_dir / "step_agent_general_skill_rules.md").read_text(
        encoding="utf-8"
    )
    reflection_prompt = (prompt_dir / "reflection_prompt.md").read_text(encoding="utf-8")

    assert "Router 只決定場景化技能和任務執行順序" in router_prompt
    assert "通用技能是場景內第二層能力" in step_prompt
    assert "target_tool_name 指向該通用技能工具" in reflection_prompt


def test_chat_turn_treats_unmatched_scene_as_chat_when_general_skill_not_selected(
    monkeypatch,
) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "企業技能路由器" in prompt_text:
            calls.append("router")
            return {
                "decision": "answer_only",
                "confidence": 0.95,
                "user_intent": "普通閒聊",
                "reason": "用戶沒有匹配任何業務流程。",
            }
        if "通用技能選擇器" in prompt_text:
            calls.append("selector")
            return {
                "use_general_skill": False,
                "selected_slug": None,
                "confidence": 0.2,
                "reason": "沒有匹配的通用技能。",
            }
        if "企業技能執行助手" in prompt_text:
            raise AssertionError("step agent should not run without an active scene skill")
        raise AssertionError("unexpected JSON prompt")

    def fake_generate_text(self, system_prompt, payload):  # noqa: ANN001
        calls.append("response")
        assert payload["current_step"] is None
        assert "active_skill" not in payload
        assert "router_decision" not in payload
        assert payload["tool_result"] is None
        return "你好，有什麼業務需要我幫忙？"

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)
    monkeypatch.setattr(LLMClient, "generate_text", fake_generate_text)

    with _test_session() as db:
        _seed_minimal_tenant(db)
        db.add(
            AgentProfile(
                id="agent_overall", tenant_id="tenant_demo", name="整體智能體", is_overall=True
            )
        )
        scene_skill = _purchase_scene_skill()
        general_skill = GeneralSkill(
            tenant_id="tenant_demo",
            slug="weather-zh",
            name="中國城市天氣",
            description="中國城市天氣查詢工具",
            homepage="https://www.weather.com.cn/",
            skill_markdown=WEATHER_SKILL_MD,
            status="published",
        )
        db.add(scene_skill)
        db.add(general_skill)
        db.flush()
        ensure_open_gallery_binding(db, "tenant_demo", "skill", scene_skill.id, "active")
        ensure_open_gallery_binding(db, "tenant_demo", "general_skill", general_skill.id, "active")
        db.commit()

        response = AgentLoop(db).handle_turn(
            ChatTurnRequest(
                tenant_id="tenant_demo",
                user_id="user_demo",
                message="你好",
            )
        )

        assert response.reply == "你好，有什麼業務需要我幫忙？"
        assert calls == ["router", "selector", "response"]
        events = db.exec(
            select(AgentEvent).where(AgentEvent.session_id == response.session_id)
        ).all()
        event_types = {event.event_type for event in events}
        assert "general_skill_selected" not in event_types
        assert "tool_call_started" not in event_types
        assert "step_agent_result_created" not in event_types


def test_general_skill_runner_repairs_failed_code(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "代碼修復器" in prompt_text:
            calls.append("repair")
            return {
                "code": (
                    "import json\n"
                    "payload=json.loads(input())\n"
                    "print(json.dumps({'success': True, 'city': '北京', 'weather': '晴', 'query': payload['query']}, ensure_ascii=False))\n"
                ),
                "rationale": "修復失敗輸出",
            }
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            return {
                "code": "import json\nprint(json.dumps({'success': False, 'error': 'first_fail'}, ensure_ascii=False))\n",
                "rationale": "首次嘗試失敗",
            }
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["success"] is True
            return {"reply": "北京今天晴。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        description="中國城市天氣查詢工具",
        homepage="https://www.weather.com.cn/",
        skill_markdown=WEATHER_SKILL_MD,
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    events: list[dict] = []

    response = GeneralSkillRunner().run(
        skill, "北京今天天氣怎麼樣", model_config, max_attempts=2, event_sink=events.append
    )

    assert response.reply == "北京今天晴。"
    assert response.structured_result["success"] is True
    assert calls == ["runner", "repair", "reply"]
    assert any(item["phase"] == "reflection_retrying" for item in response.execution_trace)
    assert any(item["phase"] == "stdout_chunk" and "first_fail" in item["text"] for item in events)


def test_general_skill_runner_materializes_folder_package(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            assert payload["skill"]["package"]["file_count"] == 2
            assert [item["path"] for item in payload["skill"]["package"]["files"]] == [
                "SKILL.md",
                "data/city.txt",
            ]
            return {
                "code": (
                    "import json\n"
                    "from pathlib import Path\n"
                    "payload=json.loads(input())\n"
                    "city=(Path(payload['skill_workspace'])/'data'/'city.txt').read_text(encoding='utf-8').strip()\n"
                    "print(json.dumps({'success': True, 'city': city, 'files': payload['skill_files']}, ensure_ascii=False))\n"
                ),
                "rationale": "讀取技能目錄裡的數據文件。",
            }
        if "通用技能運行結果審查器" in prompt_text:
            calls.append("review")
            assert payload["structured_result"]["city"] == "北京"
            return {
                "result_sufficient": True,
                "needs_retry": False,
                "terminal": False,
                "reason": "目錄文件已讀取成功。",
            }
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["city"] == "北京"
            return {"reply": "已讀取目錄技能，城市是北京。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="folder-weather",
        name="目錄天氣技能",
        description="讀取目錄內數據",
        skill_markdown="# 目錄天氣技能\n讀取 data/city.txt。",
        skill_files_json=[
            {"path": "SKILL.md", "content": "# 目錄天氣技能\n讀取 data/city.txt。"},
            {"path": "data/city.txt", "content": "北京"},
        ],
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    response = GeneralSkillRunner().run(skill, "查一下目錄裡的城市", model_config, max_attempts=1)

    assert response.reply == "已讀取目錄技能，城市是北京。"
    assert response.structured_result["city"] == "北京"
    assert response.structured_result["files"] == ["SKILL.md", "data/city.txt"]
    assert calls == ["runner", "review", "reply"]


def test_general_skill_runner_executes_bash_package_command(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            assert payload["skill"]["package"]["file_count"] == 2
            assert payload["runtime"]["languages"] == ["bash", "python"]
            return {
                "runtime": "bash",
                "code": 'set -euo pipefail\ncd "$SKILL_WORKSPACE"\nprintf \'%s\\n\' "$ARGUMENTS" | python3 scripts/weather.py\n',
                "rationale": "技能聲明 allowed-tools: Bash，並給出了調用 scripts/weather.py 的命令。",
            }
        if "通用技能運行結果審查器" in prompt_text:
            calls.append("review")
            assert payload["structured_result"]["city"] == "北京"
            return {
                "result_sufficient": True,
                "needs_retry": False,
                "terminal": False,
                "reason": "Bash 已調用包內腳本並得到結果。",
            }
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            return {"reply": "北京今天晴。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        description="中國城市天氣查詢工具",
        skill_markdown=(
            "---\n"
            "allowed-tools: Bash\n"
            "---\n"
            '```bash\nprintf \'%s\\n\' "$ARGUMENTS" | python3 "scripts/weather.py"\n```\n'
        ),
        skill_files_json=[
            {
                "path": "SKILL.md",
                "content": '---\nallowed-tools: Bash\n---\n```bash\nprintf \'%s\\n\' "$ARGUMENTS" | python3 "scripts/weather.py"\n```\n',
            },
            {
                "path": "scripts/weather.py",
                "content": (
                    "import json, sys\n"
                    "query=sys.stdin.read().strip()\n"
                    "print(json.dumps({'success': True, 'city': '北京', 'query': query}, ensure_ascii=False))\n"
                ),
            },
        ],
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    response = GeneralSkillRunner().run(skill, "北京今天天氣怎麼樣", model_config, max_attempts=1)

    assert response.reply == "北京今天晴。"
    assert response.structured_result["city"] == "北京"
    assert calls == ["runner", "review", "reply"]
    plan_events = [item for item in response.execution_trace if item["phase"] == "plan_created"]
    assert plan_events[0]["runtime"] == "bash"


def test_general_skill_runner_has_requests_in_runtime(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            return {
                "runtime": "python",
                "code": (
                    "import json\n"
                    "import requests\n"
                    "payload=json.loads(input())\n"
                    "print(json.dumps({"
                    "'success': True, "
                    "'query': payload['query'], "
                    "'requests_available': bool(requests.__version__)"
                    "}, ensure_ascii=False))\n"
                ),
                "rationale": "驗證通用技能運行環境包含 requests。",
            }
        if "通用技能運行結果審查器" in prompt_text:
            calls.append("review")
            assert payload["structured_result"]["requests_available"] is True
            return {
                "result_sufficient": True,
                "needs_retry": False,
                "terminal": False,
                "reason": "requests 可用。",
            }
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            return {"reply": "requests 可用。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="runtime-check",
        name="運行環境檢查",
        description="檢查基礎庫",
        skill_markdown="# 運行環境檢查\n需要 requests。",
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    response = GeneralSkillRunner().run(skill, "檢查 requests", model_config, max_attempts=1)

    assert response.reply == "requests 可用。"
    assert response.structured_result["requests_available"] is True
    assert calls == ["runner", "review", "reply"]


def test_general_skill_prompt_rejects_unlisted_external_apis() -> None:
    prompt = (
        Path(__file__).resolve().parents[1]
        / "app"
        / "llm"
        / "prompts"
        / "general_skill_runner_prompt.md"
    ).read_text(encoding="utf-8")

    assert "不要自行發明第三方接口" in prompt
    assert "runtime=`bash`" in prompt


def test_general_skill_runner_reflects_failed_initial_plan(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "代碼修復器" in prompt_text:
            calls.append("repair")
            assert (
                payload["previous_attempts"][0]["structured_result"]["error"]
                == "plan_generation_failed"
            )
            return {
                "code": (
                    "import json\n"
                    "payload=json.loads(input())\n"
                    "print(json.dumps({'success': True, 'city': '廊坊', 'weather': '多雲', 'query': payload['query']}, ensure_ascii=False))\n"
                ),
                "rationale": "重新輸出合法 runner JSON",
            }
        if "通用技能執行器" in prompt_text:
            calls.append("runner_failed")
            raise LLMError("Model did not return valid JSON after retry")
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["success"] is True
            return {"reply": "廊坊今天多雲。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        description="中國城市天氣查詢工具",
        homepage="https://www.weather.com.cn/",
        skill_markdown=WEATHER_SKILL_MD,
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    response = GeneralSkillRunner().run(skill, "廊坊天氣", model_config, max_attempts=2)

    assert response.reply == "廊坊今天多雲。"
    assert response.structured_result["success"] is True
    assert calls == ["runner_failed", "repair", "reply"]
    assert any(item["phase"] == "plan_failed" for item in response.execution_trace)
    assert any(item["phase"] == "reflection_retrying" for item in response.execution_trace)


def test_general_skill_runner_stops_on_non_retryable_failure(monkeypatch) -> None:
    calls: list[str] = []

    def fake_init(self, model_config):  # noqa: ANN001
        return None

    def fake_generate_json(self, system_prompt, payload):  # noqa: ANN001
        prompt_text = _system_and_stage_instructions(system_prompt, payload)
        if "通用技能執行器" in prompt_text:
            calls.append("runner")
            return {
                "code": (
                    "import json\n"
                    "print(json.dumps({"
                    "'success': False, "
                    "'error': 'source_unavailable', "
                    "'message': '天氣源不可用', "
                    "'attempted_urls': ['https://example.invalid/weather'], "
                    "'exception_type': 'TimeoutError', "
                    "'exception_message': 'timed out', "
                    "'retryable': False"
                    "}, ensure_ascii=False))\n"
                ),
                "rationale": "返回不可自動修復的失敗",
            }
        if "代碼修復器" in prompt_text:
            calls.append("repair")
            raise AssertionError("non-retryable failure should not call repair")
        if "通用技能結果回覆器" in prompt_text:
            calls.append("reply")
            assert payload["structured_result"]["retryable"] is False
            return {"reply": "當前天氣源不可用，建議稍後再試。"}
        raise AssertionError("unexpected prompt")

    monkeypatch.setattr(LLMClient, "__init__", fake_init)
    monkeypatch.setattr(LLMClient, "generate_json", fake_generate_json)

    skill = GeneralSkill(
        tenant_id="tenant_demo",
        slug="weather-zh",
        name="中國城市天氣",
        description="中國城市天氣查詢工具",
        homepage="https://www.weather.com.cn/",
        skill_markdown=WEATHER_SKILL_MD,
        status="published",
    )
    model_config = ModelConfig(
        tenant_id="tenant_demo",
        name="Fake model",
        api_key_encrypted=encrypt_secret("test-key"),
        model="fake",
        is_default=True,
        enabled=True,
    )

    response = GeneralSkillRunner().run(skill, "北京今天天氣怎麼樣", model_config, max_attempts=10)

    assert response.reply == "當前天氣源不可用，建議稍後再試。"
    assert calls == ["runner", "reply"]
    assert any(item["phase"] == "reflection_stopped" for item in response.execution_trace)


def _seed_minimal_tenant(db: Session) -> None:
    db.add(Tenant(id="tenant_demo", name="Demo"))
    db.add(
        User(
            id="user_demo",
            tenant_id="tenant_demo",
            username="user_demo",
            password_hash=hash_password("demo"),
        )
    )
    db.add(
        ModelConfig(
            tenant_id="tenant_demo",
            name="Fake model",
            api_key_encrypted=encrypt_secret("test-key"),
            model="fake",
            is_default=True,
            enabled=True,
        )
    )
    db.commit()


def _purchase_scene_skill() -> Skill:
    return Skill(
        tenant_id="tenant_demo",
        skill_id="purchase",
        name="購買商品流程",
        description="幫助用戶購買商品。",
        status="published",
        content_json={
            "business_domain": "commerce",
            "trigger_intents": ["購買", "下單"],
            "required_info": ["product_id"],
            "steps": [
                {
                    "step_id": "collect_product",
                    "name": "收集商品信息",
                    "instruction": "收集用戶想購買的商品。",
                    "expected_user_info": ["product_id"],
                    "allowed_actions": ["ask_user", "continue_flow"],
                }
            ],
        },
    )


def _test_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)
