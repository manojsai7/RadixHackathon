import json
import os
from typing import Dict, Any

def calculate_candidate_levels(profile: Dict[str, Any]) -> Dict[str, int]:
    """
    Computes candidate proficiency levels (1-10) across the 12 RADIX categories based on skills.
    Confidence boosts are applied, and additional points are awarded for certifications, internships, and hackathons.
    """
    categories = ["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS"]
    levels = {cat: 1 for cat in categories}  # default baseline is level 1
    
    # 1. Base levels from skills list
    skills = profile.get("skills", [])
    skills_points = {cat: 0 for cat in categories}
    
    for skill in skills:
        cat = skill.get("category_code")
        if cat in skills_points:
            conf = skill.get("confidence", "medium")
            weight = 3 if conf == "high" else (2 if conf == "medium" else 1)
            skills_points[cat] += weight
            
    for cat in categories:
        points = skills_points[cat]
        # Map points to 1-10 scale
        if points > 0:
            levels[cat] = min(10, 1 + points)
            
    # 2. Boost levels based on Internships and Hackathons
    internships = profile.get("internships", [])
    hackathons = profile.get("hackathons", [])
    certifications = profile.get("certifications", [])
    
    # Internships boost SWE (Software Engineering) and COMM (Communication)
    if internships:
        levels["SWE"] = min(10, levels["SWE"] + min(2, len(internships)))
        levels["COMM"] = min(10, levels["COMM"] + min(2, len(internships)))
        
    # Hackathons boost COD, DSA, and APTI
    if hackathons:
        levels["COD"] = min(10, levels["COD"] + min(2, len(hackathons)))
        levels["APTI"] = min(10, levels["APTI"] + min(1, len(hackathons)))
        levels["DSA"] = min(10, levels["DSA"] + min(1, len(hackathons)))

    # Certifications boost corresponding categories
    for cert in certifications:
        cert_lower = cert.lower()
        if "cloud" in cert_lower or "aws" in cert_lower or "azure" in cert_lower or "gcp" in cert_lower:
            levels["CLOUD"] = min(10, levels["CLOUD"] + 2)
        if "security" in cert_lower or "network" in cert_lower or "ccna" in cert_lower:
            levels["NETW"] = min(10, levels["NETW"] + 2)
        if "database" in cert_lower or "sql" in cert_lower or "oracle" in cert_lower:
            levels["SQL"] = min(10, levels["SQL"] + 2)
        if "machine learning" in cert_lower or "ai" in cert_lower or "deep learning" in cert_lower:
            levels["AI"] = min(10, levels["AI"] + 2)
            
    return levels

def compute_talent_check(company: str, role: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compares candidate profile levels against company standard skillset levels for a given role.
    """
    # Load company skillsets
    base_dir = os.path.dirname(os.path.abspath(__file__))
    skillset_path = os.path.join(base_dir, 'data', 'talent_check_company_skillsets.json')
    
    if not os.path.exists(skillset_path):
        raise FileNotFoundError(f"Company skillset guidelines not found at {skillset_path}")
        
    with open(skillset_path, 'r') as f:
        company_skillsets = json.load(f)
        
    if company not in company_skillsets:
        raise ValueError(f"Company '{company}' not found in skillset guidelines.")
        
    roles_data = company_skillsets[company]
    if role not in roles_data:
        # fallback to the first available role if role is mismatch or empty
        role = list(roles_data.keys())[0]
        
    requirements = roles_data[role]
    candidate_levels = calculate_candidate_levels(profile)
    
    skillset_gap = []
    total_requirements = 0
    total_coverage = 0
    
    for cat, req_lvl in requirements.items():
        cand_lvl = candidate_levels.get(cat, 1)
        gap = cand_lvl < req_lvl
        skillset_gap.append({
            "category_code": cat,
            "required_level": req_lvl,
            "candidate_level": cand_lvl,
            "gap": gap
        })
        
        # Scoring metrics
        total_requirements += req_lvl
        total_coverage += min(req_lvl, cand_lvl)
        
    # Calculate readiness score (0-100)
    readiness_score = int((total_coverage / total_requirements) * 100) if total_requirements > 0 else 0
    
    return {
        "company": company,
        "role": role,
        "skillset_gap": skillset_gap,
        "readiness_score": readiness_score
    }

def load_candidate_profile(filepath: str) -> Dict[str, Any]:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return {}
