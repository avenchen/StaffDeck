from __future__ import annotations

import json
import os
import selectors
import subprocess
import time
from collections.abc import Mapping
from contextlib import suppress
from typing import Any

import httpx

from app.tools.mcp_builtin import BuiltinMCPError, execute_builtin_mcp


class MCPClientError(RuntimeError):
    pass


def execute_mcp_tool(
    config: dict[str, Any],
    arguments: dict[str, Any],
    timeout_seconds: float = 10,
) -> Any:
    normalized = dict(config or {})
    transport = _transport(normalized)
    if transport == "builtin":
        try:
            return execute_builtin_mcp(normalized, arguments)
        except BuiltinMCPError as exc:
            raise MCPClientError(str(exc)) from exc
    if transport == "stdio":
        return _execute_stdio(normalized, arguments, timeout_seconds)
    if transport in {"http", "streamable_http"}:
        return _execute_http(normalized, arguments, timeout_seconds)
    if transport == "sse":
        raise MCPClientError("MCP SSE transport 暂未接入；当前支持 stdio 和 HTTP JSON-RPC。")
    raise MCPClientError(f"不支持的 MCP transport：{transport or '<empty>'}")


def _transport(config: dict[str, Any]) -> str:
    raw = str(config.get("transport") or "").strip().lower()
    if raw:
        return raw
    server = str(config.get("server") or config.get("server_id") or "").strip()
    if server == "builtin.demo":
        return "builtin"
    if config.get("command"):
        return "stdio"
    if config.get("url") or config.get("endpoint"):
        return "http"
    return "builtin"


def _tool_name(config: dict[str, Any]) -> str:
    name = str(config.get("tool") or config.get("tool_name") or config.get("name") or "").strip()
    if not name:
        raise MCPClientError("MCP config 缺少 tool/tool_name。")
    return name


def _execute_stdio(config: dict[str, Any], arguments: dict[str, Any], timeout_seconds: float) -> Any:
    command = _stdio_command(config)
    env = os.environ.copy()
    raw_env = config.get("env")
    if isinstance(raw_env, Mapping):
        env.update({str(key): str(value) for key, value in raw_env.items()})
    cwd = str(config["cwd"]) if config.get("cwd") else None
    proc = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    try:
        _send_json(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": _initialize_params()})
        response = _read_response(proc, expected_id=1, timeout_seconds=timeout_seconds)
        _raise_json_rpc_error(response)
        _send_json(proc, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
        _send_json(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": _tool_name(config), "arguments": arguments},
            },
        )
        response = _read_response(proc, expected_id=2, timeout_seconds=timeout_seconds)
        _raise_json_rpc_error(response)
        return _extract_tool_result(response.get("result"))
    finally:
        _close_process(proc)


def _stdio_command(config: dict[str, Any]) -> list[str]:
    command = config.get("command")
    args = config.get("args") or []
    if isinstance(command, list):
        parts = [str(part) for part in command]
    elif isinstance(command, str) and command.strip():
        parts = [command.strip()]
    else:
        raise MCPClientError("stdio MCP config 缺少 command。")
    if not isinstance(args, list):
        raise MCPClientError("stdio MCP config 的 args 必须是数组。")
    return [*parts, *[str(arg) for arg in args]]


def _execute_http(config: dict[str, Any], arguments: dict[str, Any], timeout_seconds: float) -> Any:
    url = str(config.get("url") or config.get("endpoint") or "").strip()
    if not url:
        raise MCPClientError("HTTP MCP config 缺少 url/endpoint。")
    headers = config.get("headers") if isinstance(config.get("headers"), dict) else {}
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": _tool_name(config), "arguments": arguments},
    }
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(url, headers={str(k): str(v) for k, v in headers.items()}, json=payload)
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPStatusError as exc:
        raise MCPClientError(f"HTTP MCP 返回异常状态码：{exc.response.status_code}") from exc
    except Exception as exc:
        raise MCPClientError(str(exc)) from exc
    if not isinstance(body, dict):
        raise MCPClientError("HTTP MCP 返回内容不是 JSON-RPC object。")
    _raise_json_rpc_error(body)
    return _extract_tool_result(body.get("result"))


def _initialize_params() -> dict[str, Any]:
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "UltraRAG4", "version": "0.1.0"},
    }


def _send_json(proc: subprocess.Popen[str], payload: dict[str, Any]) -> None:
    if proc.stdin is None:
        raise MCPClientError("MCP stdio stdin 不可用。")
    proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
    proc.stdin.flush()


def _read_response(
    proc: subprocess.Popen[str],
    expected_id: int,
    timeout_seconds: float,
) -> dict[str, Any]:
    if proc.stdout is None:
        raise MCPClientError("MCP stdio stdout 不可用。")
    selector = selectors.DefaultSelector()
    selector.register(proc.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + max(timeout_seconds, 0.1)
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise MCPClientError(f"MCP stdio 等待响应超时：id={expected_id}")
            events = selector.select(remaining)
            if not events:
                raise MCPClientError(f"MCP stdio 等待响应超时：id={expected_id}")
            line = proc.stdout.readline()
            if not line:
                stderr = _read_stderr(proc)
                raise MCPClientError(f"MCP stdio server 提前退出。{stderr}".strip())
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if payload.get("id") == expected_id:
                return payload
    finally:
        selector.close()


def _raise_json_rpc_error(payload: dict[str, Any]) -> None:
    if "error" not in payload:
        return
    error = payload.get("error") or {}
    if isinstance(error, dict):
        message = str(error.get("message") or error)
    else:
        message = str(error)
    raise MCPClientError(message)


def _extract_tool_result(result: Any) -> Any:
    if not isinstance(result, dict):
        return result
    if result.get("isError"):
        raise MCPClientError(_content_text(result.get("content")) or "MCP tool returned isError=true。")
    content = result.get("content")
    if not isinstance(content, list):
        return result
    extracted: list[Any] = []
    for item in content:
        if not isinstance(item, dict):
            extracted.append(item)
            continue
        if item.get("type") == "text":
            text = str(item.get("text") or "")
            extracted.append(_parse_text_content(text))
        else:
            extracted.append(item)
    if len(extracted) == 1:
        return extracted[0]
    return extracted


def _parse_text_content(text: str) -> Any:
    stripped = text.strip()
    if not stripped:
        return ""
    with suppress(json.JSONDecodeError):
        return json.loads(stripped)
    return text


def _content_text(content: Any) -> str:
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            parts.append(str(item.get("text") or ""))
    return "\n".join(part for part in parts if part)


def _close_process(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    with suppress(subprocess.TimeoutExpired):
        proc.wait(timeout=1)
        return
    proc.kill()
    with suppress(Exception):
        proc.wait(timeout=1)


def _read_stderr(proc: subprocess.Popen[str]) -> str:
    if proc.stderr is None:
        return ""
    with suppress(Exception):
        return proc.stderr.read()[:1000]
    return ""
