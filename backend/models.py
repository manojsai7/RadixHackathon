from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class Skill(BaseModel):
    skill_name: str = Field(description="Name of the skill or technology")
    category_code: Literal["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"] = Field(
        description="One of the 12 RADIX skill categories or OTHER"
    )
    evidence: str = Field(description="Short quote or reason from the source document")
    confidence: Literal["high", "medium", "low"] = Field(description="Confidence score: high, medium, or low")

class ParsedOutput(BaseModel):
    source_type: Literal["jd", "resume"]
    source_file: str
    company: str
    role: str
    skills: List[Skill]

class Profile(BaseModel):
    name: str = Field(default="", description="Candidate's name")
    email: str = Field(default="", description="Candidate's email")
    education: str = Field(default="", description="Candidate's educational background")
    skills: List[Skill] = Field(default_factory=list, description="List of skills")
    hackathons: List[str] = Field(default_factory=list, description="Hackathons attended")
    internships: List[str] = Field(default_factory=list, description="Internships completed")
    certifications: List[str] = Field(default_factory=list, description="Professional certifications")
    preferred_roles: List[str] = Field(default_factory=list, description="Preferred roles/positions")
    cv_file: Optional[str] = Field(default=None, description="Path to the uploaded CV file")

class SkillsetGapItem(BaseModel):
    category_code: str
    required_level: int
    candidate_level: int
    gap: bool

class TalentCheckResult(BaseModel):
    company: str
    role: str
    skillset_gap: List[SkillsetGapItem]
    readiness_score: int

class SkillMatchResult(BaseModel):
    jd_source_file: str
    match_score: int
    matched_skills: List[str]
    missing_skills: List[str]
