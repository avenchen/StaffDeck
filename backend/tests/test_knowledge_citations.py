from app.knowledge.citations import (
    CITATION_EXCERPT_CHAR_LIMIT,
    compact_knowledge_citation_labels,
    knowledge_citations_from_results,
)


def test_compact_knowledge_citation_labels_renumbers_by_first_appearance() -> None:
    content, citations = compact_knowledge_citation_labels(
        "先參考手冊。[4] 再確認規範。[1] 最後仍參考手冊。[4]",
        [
            {"id": "kref_1", "label": "[1]", "title": "規範"},
            {"id": "kref_2", "label": "[2]", "title": "無關來源"},
            {"id": "kref_3", "label": "[3]", "title": "另一無關來源"},
            {"id": "kref_4", "label": "[4]", "title": "手冊"},
        ],
    )

    assert content == "先參考手冊。[1] 再確認規範。[2] 最後仍參考手冊。[1]"
    assert [(item["label"], item["title"]) for item in citations] == [
        ("[1]", "手冊"),
        ("[2]", "規範"),
    ]


def test_compact_knowledge_citation_labels_supports_historical_filtered_metadata() -> None:
    content, citations = compact_knowledge_citation_labels(
        "排查步驟來自手冊。[1] 區域故障需要報修。[4]",
        [
            {"id": "kref_1", "label": "[1]", "title": "排查手冊"},
            {"id": "kref_4", "label": "[4]", "title": "網絡故障"},
        ],
    )

    assert content == "排查步驟來自手冊。[1] 區域故障需要報修。[2]"
    assert [item["label"] for item in citations] == ["[1]", "[2]"]


def test_knowledge_citations_prefer_wiki_concepts_over_evidence_pack() -> None:
    citations = knowledge_citations_from_results(
        [
            {
                "selected_concepts": [
                    {
                        "concept_id": "sources/vue3-coding-standards",
                        "type": "Source Document",
                        "title": "前端編碼規範",
                        "description": "Vue 3、Vite、TypeScript、組件編寫和命名規範。",
                        "source_refs": [{"source_path": "vue3-coding-standards.md"}],
                    }
                ],
                "evidence_pack": [
                    {
                        "chunk_id": "kchunk_citation_demo",
                        "document_id": "kdoc_citation_demo",
                        "bucket_id": "kbucket_citation_demo",
                        "source_path": "citation-demo.md",
                        "section_path": "知識引用測試說明 / 引用規則",
                        "summary": "回答基於業務資料時必須展示可點擊知識引用。",
                        "excerpt": "StaffDeck 引用測試規則。",
                    }
                ],
            }
        ]
    )

    assert citations[0]["kind"] == "concept"
    assert citations[0]["title"] == "前端編碼規範"
    assert citations[0]["source_path"] == "vue3-coding-standards.md"


def test_knowledge_citations_use_concept_content_instead_of_summary() -> None:
    content = "完整 Content 段落。" * 120
    citations = knowledge_citations_from_results(
        [
            {
                "selected_concepts": [
                    {
                        "concept_id": "sources/chatgpt-memory/sections/sec-4",
                        "type": "Source Section",
                        "title": "段落組 1",
                        "description": "段落組 1 摘要，不完整。",
                        "content": content,
                        "source_refs": [{"source_path": "memory.md"}],
                    }
                ],
            }
        ]
    )

    assert citations[0]["content"] == content
    assert citations[0]["excerpt"] == content
    assert citations[0]["summary"] == "段落組 1 摘要，不完整。"


def test_knowledge_citations_keep_long_evidence_excerpt_until_display_limit() -> None:
    excerpt = "引用片段" * 900
    citations = knowledge_citations_from_results(
        [
            {
                "evidence_pack": [
                    {
                        "chunk_id": "kchunk_long_excerpt",
                        "document_id": "kdoc_long_excerpt",
                        "bucket_id": "kbucket_long_excerpt",
                        "source_path": "long-citation.md",
                        "section_path": "長引用測試",
                        "summary": "長引用摘要",
                        "excerpt": excerpt,
                    }
                ],
            }
        ]
    )

    assert citations[0]["excerpt"] == excerpt


def test_knowledge_citations_cap_evidence_excerpt_at_display_limit() -> None:
    excerpt = "x" * (CITATION_EXCERPT_CHAR_LIMIT + 16)
    citations = knowledge_citations_from_results(
        [
            {
                "evidence_pack": [
                    {
                        "chunk_id": "kchunk_capped_excerpt",
                        "document_id": "kdoc_capped_excerpt",
                        "bucket_id": "kbucket_capped_excerpt",
                        "source_path": "capped-citation.md",
                        "section_path": "引用上限測試",
                        "summary": "引用上限摘要",
                        "excerpt": excerpt,
                    }
                ],
            }
        ]
    )

    assert citations[0]["excerpt"] == excerpt[:CITATION_EXCERPT_CHAR_LIMIT]
