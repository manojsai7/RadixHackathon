import json
import os
from typing import List, Dict, Any

def normalize_skill(name: str) -> str:
    """Normalizes skill names to lowercase, removes punctuation, and trims whitespace."""
    n = name.lower().strip()
    n = re_sub = n.replace("-", "").replace("_", "").replace(" ", "").replace(".", "")
    return n

def are_skills_similar(skill_a: str, skill_b: str) -> bool:
    norm_a = normalize_skill(skill_a)
    norm_b = normalize_skill(skill_b)
    
    # Direct match or containment
    if norm_a == norm_b or norm_a in norm_b or norm_b in norm_a:
        return True
        
    # Synonyms dictionary
    synonyms = {
        "postgres": ["postgresql", "postgres sql", "sql"],
        "postgresql": ["postgres", "postgres sql", "sql"],
        "mongodb": ["mongo", "nosql"],
        "kubernetes": ["k8s", "cloud"],
        "docker": ["containers", "cloud"],
        "aws": ["amazon web services", "cloud"],
        "gcp": ["google cloud platform", "google cloud", "cloud"],
        "azure": ["microsoft azure", "cloud"],
        "machinelearning": ["ml", "ai", "artificialintelligence"],
        "ml": ["machinelearning", "ai", "artificialintelligence"],
        "deeplearning": ["dl", "ai", "artificialintelligence"],
        "generativeai": ["genai", "llm", "ai"],
        "artificialintelligence": ["ai", "ml"],
        "react": ["reactjs", "react.js", "frontend", "javascript"],
        "reactjs": ["react", "react.js", "frontend", "javascript"],
        "typescript": ["ts", "javascript"],
        "javascript": ["js", "typescript"],
        "systemdesign": ["sysd", "architecture", "distributed systems"],
        "distributedprogramming": ["dsa", "algorithms"],
        "problemsolving": ["aptitude", "apti", "analytical"]
    }
    
    syns_a = synonyms.get(norm_a, [])
    syns_b = synonyms.get(norm_b, [])
    
    if norm_b in syns_a or norm_a in syns_b:
        return True
        
    # Check intersection of synonym lists
    if set(syns_a) & set(syns_b):
        return True
        
    return False

def compute_skill_match(jd_skills: List[Dict[str, Any]], profile_skills: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Matches JD required skills against candidate profile skills.
    Returns match_score, matched_skills, and missing_skills.
    """
    matched_skills = []
    missing_skills = []
    
    if not jd_skills:
        return {
            "match_score": 100,
            "matched_skills": [],
            "missing_skills": []
        }
        
    for jd_skill in jd_skills:
        jd_name = jd_skill.get("skill_name", "")
        
        # Check if candidate has a matching skill
        is_matched = False
        for prof_skill in profile_skills:
            prof_name = prof_skill.get("skill_name", "")
            if are_skills_similar(jd_name, prof_name):
                is_matched = True
                break
                
        if is_matched:
            matched_skills.append(jd_name)
        else:
            missing_skills.append(jd_name)
            
    # Calculate score
    total_required = len(jd_skills)
    match_score = int((len(matched_skills) / total_required) * 100) if total_required > 0 else 100
    
    return {
        "match_score": match_score,
        "matched_skills": list(set(matched_skills)),
        "missing_skills": list(set(missing_skills))
    }

def load_jd_skills(filepath: str) -> List[Dict[str, Any]]:
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                return data.get("skills", [])
        except Exception:
            pass
    return []

def load_profile_skills(filepath: str) -> List[Dict[str, Any]]:
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                return data.get("skills", [])
        except Exception:
            pass
    return []
