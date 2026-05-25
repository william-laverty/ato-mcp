from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


Source = Literal["ato", "legislation", "austlii", "state_revenue"]

DocType = Literal[
    "ATO_GUIDE",
    "ATO_RULING_TR", "ATO_RULING_TD", "ATO_RULING_GSTR", "ATO_RULING_GSTD",
    "ATO_RULING_PR", "ATO_RULING_CR", "ATO_RULING_LCR", "ATO_RULING_PCG",
    "ATO_RULING_MT", "ATO_RULING_FTR",
    "ATO_PBR", "ATO_CASE_SUMMARY",
    "LEGISLATION_ITAA1997", "LEGISLATION_ITAA1936", "LEGISLATION_GST_ACT",
    "LEGISLATION_FBT_ACT", "LEGISLATION_TAA", "LEGISLATION_SIS_ACT",
    "LEGISLATION_ABN_ACT",
    "STATE_REV_NSW_PAYROLL", "STATE_REV_NSW_LAND", "STATE_REV_NSW_DUTY",
    "STATE_REV_VIC_PAYROLL", "STATE_REV_VIC_LAND", "STATE_REV_VIC_DUTY",
    "STATE_REV_QLD_PAYROLL", "STATE_REV_QLD_LAND", "STATE_REV_QLD_DUTY",
    "STATE_REV_SA_PAYROLL",  "STATE_REV_SA_LAND",  "STATE_REV_SA_DUTY",
    "STATE_REV_WA_PAYROLL",  "STATE_REV_WA_LAND",  "STATE_REV_WA_DUTY",
    "STATE_REV_TAS_PAYROLL", "STATE_REV_TAS_LAND", "STATE_REV_TAS_DUTY",
    "STATE_REV_ACT_PAYROLL", "STATE_REV_ACT_LAND", "STATE_REV_ACT_DUTY",
    "STATE_REV_NT_PAYROLL",  "STATE_REV_NT_LAND",  "STATE_REV_NT_DUTY",
]


class Doc(BaseModel):
    doc_id: str = Field(min_length=1)
    source: Source
    url: HttpUrl
    title: str
    jurisdiction: str = "AU"
    doc_type: DocType
    effective_from: str | None = None
    effective_to: str | None = None
    published_at: str | None = None
    retrieved_at: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class Chunk(BaseModel):
    chunk_id: str = Field(min_length=1)
    doc_id: str = Field(min_length=1)
    ord: int = Field(ge=0)
    text: str
    heading_path: list[str] = Field(default_factory=list)
    effective_from: str | None = None
    effective_to: str | None = None
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)
