import os
import json
import re
from typing import Dict
from parse_jd import extract_text, call_llm_for_parsing, SKILL_DICTIONARY

def fallback_parse_resume(text: str, filename: str) -> Dict:
    # Heuristically extract candidate details from text
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # 1. Email Extraction
    email_match = re.search(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b', text)
    email = email_match.group(0) if email_match else "unknown@example.com"
    
    # 2. Name Extraction (assume first line is name, unless it looks like a heading or email)
    name = "Unknown Candidate"
    if lines:
        for line in lines[:3]:
            # If line doesn't contain email, website, and has 2-3 words, assume it is name
            if "@" not in line and "http" not in line and len(line.split()) in [2, 3]:
                name = line
                break
        if name == "Unknown Candidate" and lines:
            name = lines[0]
            
    # 3. Education Extraction
    education = "Not Specified"
    edu_keywords = ["bachelor", "master", "phd", "b.s", "m.s", "b.tech", "btech", "degree", "university", "college"]
    for line in lines:
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in edu_keywords):
            education = line
            if len(education) > 100:
                education = education[:97] + "..."
            break
            
    # 4. Skill Extraction (reusing the skill dictionary)
    sentences = re.split(r'[.!?\n]', text)
    extracted_skills = []
    seen_skills = set()
    
    for sentence in sentences:
        sentence_clean = sentence.strip()
        if not sentence_clean:
            continue
        sentence_lower = sentence_clean.lower()
        
        for kw, (cat, conf) in SKILL_DICTIONARY.items():
            if kw in seen_skills:
                continue
            pattern = r'\b' + re.escape(kw) + r'\b'
            if kw == "c++":
                pattern = r'c\+\+'
            elif kw == "c#":
                pattern = r'c#'
                
            if re.search(pattern, sentence_lower):
                evidence = sentence_clean
                if len(evidence) > 120:
                    evidence = evidence[:117] + "..."
                    
                extracted_skills.append({
                    "skill_name": kw.upper() if len(kw) <= 4 or kw in ["python", "javascript", "typescript", "kubernetes", "postgresql"] else kw.capitalize(),
                    "category_code": cat,
                    "evidence": evidence,
                    "confidence": conf
                })
                seen_skills.add(kw)
                
    # If no skills found, inject some defaults
    if not extracted_skills:
        extracted_skills = [
            {"skill_name": "Coding", "category_code": "COD", "evidence": "Assumed general programming skills", "confidence": "low"},
            {"skill_name": "Communication", "category_code": "COMM", "evidence": "Assumed candidate communication skills", "confidence": "low"}
        ]
        
    return {
        "source_type": "resume",
        "source_file": os.path.basename(filename),
        "name": name,
        "email": email,
        "education": education,
        "company": "Unknown",
        "role": "Candidate",
        "skills": extracted_skills
    }

def parse_resume_file(filepath: str) -> Dict:
    text = extract_text(filepath)
    # Check if LLM should be called
    if os.environ.get('OPENROUTER_API_KEY') or os.environ.get('GEMINI_API_KEY') or os.environ.get('GROQ_API_KEY'):
        result = call_llm_for_parsing(text, "resume", filepath)
        
        # Parse fallback details if LLM missed basic info
        fallback_details = fallback_parse_resume(text, filepath)
        if "name" not in result or result["name"] in ["Unknown", "Unknown Candidate"]:
            result["name"] = fallback_details["name"]
        if "email" not in result or result["email"] in ["Unknown", "unknown@example.com"]:
            result["email"] = fallback_details["email"]
        if "education" not in result or result["education"] in ["Unknown", "Not Specified"]:
            result["education"] = fallback_details["education"]
            
        return result
    else:
        return fallback_parse_resume(text, filepath)
