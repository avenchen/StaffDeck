"""Schemas for the knowledge-base Wiki view.

The Wiki view is a read/browse layer over existing knowledge data
(``KnowledgeBase → KnowledgeDocument → KnowledgeBucket → KnowledgeChunk``)
plus an LLM question-answering endpoint that cites the retrieved buckets.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class WikiBucketNode(BaseModel):
    id: str
    bucket_key: str
    title: str
    summary: str
    token_estimate: int
    chunk_count: int


class WikiDocumentNode(BaseModel):
    id: str
    title: str
    filename: str
    file_type: str
    status: str
    bucket_count: int
    chunk_count: int
    buckets: list[WikiBucketNode] = Field(default_factory=list)


class WikiOutline(BaseModel):
    knowledge_base_id: str
    name: str
    description: Optional[str] = None
    document_count: int = 0
    bucket_count: int = 0
    chunk_count: int = 0
    documents: list[WikiDocumentNode] = Field(default_factory=list)


class WikiAskRequest(BaseModel):
    tenant_id: str
    agent_id: Optional[str] = None
    knowledge_base_id: Optional[str] = None
    query: str
    model_config_id: Optional[str] = None


class WikiCitation(BaseModel):
    index: int
    bucket_id: Optional[str] = None
    document_id: Optional[str] = None
    title: str
    snippet: str
    source_ref: Optional[str] = None


class WikiAnswer(BaseModel):
    answer: str
    citations: list[WikiCitation] = Field(default_factory=list)
    trace: list[dict[str, Any]] = Field(default_factory=list)
