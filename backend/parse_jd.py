import os
import json
import re
import requests
from typing import Dict, List
import pypdf
import docx2txt

# ---------- SKILL DICTIONARY FOR FALLBACK PARSING ----------
SKILL_DICTIONARY = {
    # Coding / Programming Languages
    "python": ("COD", "high"),
    "javascript": ("COD", "high"),
    "typescript": ("COD", "high"),
    "java": ("COD", "high"),
    "c++": ("COD", "high"),
    "c#": ("COD", "high"),
    "golang": ("COD", "high"),
    "rust": ("COD", "high"),
    "ruby": ("COD", "high"),
    "php": ("COD", "high"),
    "html": ("COD", "high"),
    "css": ("COD", "high"),
    "react": ("COD", "high"),
    "angular": ("COD", "high"),
    "vue": ("COD", "high"),
    
    # Data Structures & Algorithms
    "dsa": ("DSA", "high"),
    "data structures": ("DSA", "high"),
    "algorithms": ("DSA", "high"),
    "trees": ("DSA", "medium"),
    "graphs": ("DSA", "medium"),
    "dynamic programming": ("DSA", "medium"),
    
    # Object Oriented Design
    "ood": ("OOD", "high"),
    "oop": ("OOD", "high"),
    "object-oriented": ("OOD", "high"),
    "design patterns": ("OOD", "high"),
    
    # Aptitude
    "aptitude": ("APTI", "high"),
    "analytical": ("APTI", "medium"),
    "problem solving": ("APTI", "high"),
    "logical reasoning": ("APTI", "high"),
    
    # Communication
    "communication": ("COMM", "high"),
    "verbal": ("COMM", "high"),
    "written": ("COMM", "high"),
    "presentation": ("COMM", "medium"),
    "collaboration": ("COMM", "high"),
    
    # AI / Machine Learning
    "ai": ("AI", "high"),
    "machine learning": ("AI", "high"),
    "ml": ("AI", "high"),
    "deep learning": ("AI", "high"),
    "pytorch": ("AI", "high"),
    "tensorflow": ("AI", "high"),
    "generative ai": ("AI", "high"),
    
    # Cloud
    "cloud": ("CLOUD", "high"),
    "aws": ("CLOUD", "high"),
    "azure": ("CLOUD", "high"),
    "gcp": ("CLOUD", "high"),
    "google cloud": ("CLOUD", "high"),
    "docker": ("CLOUD", "medium"),
    "kubernetes": ("CLOUD", "medium"),
    "devops": ("CLOUD", "high"),
    
    # SQL & Databases
    "sql": ("SQL", "high"),
    "database": ("SQL", "high"),
    "postgresql": ("SQL", "high"),
    "mysql": ("SQL", "high"),
    "mongodb": ("SQL", "high"),
    "oracle": ("SQL", "high"),
    
    # Software Engineering Practices
    "swe": ("SWE", "high"),
    "software engineering": ("SWE", "high"),
    "git": ("SWE", "high"),
    "ci/cd": ("SWE", "high"),
    "testing": ("SWE", "high"),
    "agile": ("SWE", "high"),
    
    # System Design
    "sysd": ("SYSD", "high"),
    "system design": ("SYSD", "high"),
    "scalability": ("SYSD", "high"),
    "distributed systems": ("SYSD", "high"),
    "microservices": ("SYSD", "high"),
    
    # Networking
    "networking": ("NETW", "high"),
    "tcp/ip": ("NETW", "high"),
    "dns": ("NETW", "medium"),
    "http": ("NETW", "medium"),
    
    # Operating Systems
    "os": ("OS", "high"),
    "operating systems": ("OS", "high"),
    "linux": ("OS", "high"),
    "unix": ("OS", "high"),
    "windows": ("OS", "high")
}

def extract_text(filepath: str) -> str:
    _, ext = os.path.splitext(filepath.lower())
    if ext == '.pdf':
        text = ""
        try:
            with open(filepath, 'rb') as f:
                reader = pypdf.PdfReader(f)
                for page in reader.pages:
                    content = page.extract_text()
                    if content:
                        text += content + "\n"
        except Exception as e:
            print(f"Error reading PDF {filepath}: {e}")
        return text
    elif ext == '.docx':
        try:
            return docx2txt.process(filepath)
        except Exception as e:
            print(f"Error reading DOCX {filepath}: {e}")
            return ""
    else:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading text file {filepath}: {e}")
            return ""

def fallback_parse_jd(text: str, filename: str) -> Dict:
    # Heuristically extract company and role from file name or first lines
    basename = os.path.splitext(os.path.basename(filename))[0]
    # Expect name format: Google-Software_Engineer or Google_SoftwareEngineer
    parts = re.split(r'[-_]', basename)
    company = "Unknown"
    role = "Unknown"
    
    if len(parts) >= 2:
        company = parts[0].strip()
        role = " ".join(parts[1:]).strip()
    else:
        # Check text lines for company/role keywords
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        for line in lines[:5]:
            if "position" in line.lower() or "role" in line.lower() or "job description" in line.lower():
                role = line
                break
        if role == "Unknown" and lines:
            role = lines[0][:50]
    
    # Extract skills by matching dictionary keywords in sentences
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
            # match word boundaries to prevent substring matching like 'c' in 'act'
            pattern = r'\b' + re.escape(kw) + r'\b'
            # special case for languages with symbols like C++
            if kw == "c++":
                pattern = r'c\+\+'
            elif kw == "c#":
                pattern = r'c#'
            
            if re.search(pattern, sentence_lower):
                # crop sentence to readable length
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
                
    # If no skills found, inject some defaults so the app functions
    if not extracted_skills:
        extracted_skills = [
            {"skill_name": "Coding", "category_code": "COD", "evidence": "Assumed core programming skills", "confidence": "low"},
            {"skill_name": "Problem Solving", "category_code": "APTI", "evidence": "Assumed general engineering criteria", "confidence": "low"}
        ]

    return {
        "source_type": "jd",
        "source_file": os.path.basename(filename),
        "company": company,
        "role": role,
        "skills": extracted_skills
    }

def call_llm_for_parsing(text: str, source_type: str, filename: str) -> Dict:
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    gemini_key = os.environ.get('GEMINI_API_KEY')
    groq_key = os.environ.get('GROQ_API_KEY')
    
    prompt = f"""
You are an expert recruiter and skill extraction tool. Analyze the provided {source_type} document and extract a structured list of skills and technologies.
Assign each skill to exactly one of the following 12 RADIX categories or OTHER:
COD (Coding/Languages), DSA (Algorithms/Data Structures), OOD (Object-Oriented Design), APTI (Aptitude/Problem Solving), COMM (Communication/Teamwork), AI (ML/Deep Learning/NLP), CLOUD (AWS/Azure/GCP/Docker/K8s), SQL (Databases/Querying), SWE (Git/Testing/Agile), SYSD (System Design/Microservices), NETW (Networking/TCP/IP), OS (Linux/Unix/Windows), OTHER.

Return a JSON object in the following format:
{{
  "source_type": "{source_type}",
  "source_file": "{os.path.basename(filename)}",
  "company": "Name of Company (or Unknown)",
  "role": "Job Role / Title (or Unknown)",
  "skills": [
    {{
      "skill_name": "Python",
      "category_code": "COD",
      "evidence": "Short sentence or bullet point quoting this requirement from the text",
      "confidence": "high"
    }}
  ]
}}

Document Text:
{text[:6000]}
"""

    headers = {}
    payload = {}
    url = ""
    
    if openrouter_key:
        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {openrouter_key}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'google/gemini-2.0-flash-001',
            'messages': [{'role': 'user', 'content': prompt}],
            'response_format': {'type': 'json_object'},
            'temperature': 0.1
        }
    elif gemini_key:
        # direct Gemini API call (Gemini Developer API)
        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}'
        headers = {'Content-Type': 'application/json'}
        payload = {
            "contents": [{"parts": [{"text": prompt + "\n\nMake sure the response is strict JSON. Do not include markdown code block syntax."}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
    elif groq_key:
        url = 'https://api.groq.com/openai/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {groq_key}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'llama-3.3-70b-versatile',
            'messages': [{'role': 'user', 'content': prompt}],
            'response_format': {'type': 'json_object'},
            'temperature': 0.1
        }
    else:
        raise ValueError("No API Key configured.")
        
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        if response.status_code != 200:
            raise Exception(f"API returned status {response.status_code}: {response.text}")
        
        data = response.json()
        
        if openrouter_key or groq_key:
            content = data['choices'][0]['message']['content']
        elif gemini_key:
            content = data['candidates'][0]['content']['parts'][0]['text']
        
        parsed = json.loads(content)
        return parsed
    except Exception as e:
        print(f"LLM parsing failed for {filename}: {e}. Falling back to rule-based parsing...")
        return fallback_parse_jd(text, filename)

def parse_jd_file(filepath: str) -> Dict:
    text = extract_text(filepath)
    # Check if we should call LLM or just run fallback directly
    if os.environ.get('OPENROUTER_API_KEY') or os.environ.get('GEMINI_API_KEY') or os.environ.get('GROQ_API_KEY'):
        return call_llm_for_parsing(text, "jd", filepath)
    else:
        return fallback_parse_jd(text, filepath)
