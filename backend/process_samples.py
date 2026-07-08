import os
import glob
import json
from parse_jd import parse_jd_file
from parse_resume import parse_resume_file
from models import Profile, ParsedOutput

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JD_FOLDER = os.path.join(BASE_DIR, "sample_inputs", "jds")
RESUME_FOLDER = os.path.join(BASE_DIR, "sample_inputs", "resumes")
DATA_FOLDER = os.path.join(BASE_DIR, "data")

# Ensure data folder exists
os.makedirs(DATA_FOLDER, exist_ok=True)

def create_profile_from_resume(resume_data, output_path):
    """Automatically structures a Profile from resume details and saves it."""
    profile_data = {
        "name": resume_data.get("name", "Candidate"),
        "email": resume_data.get("email", "candidate@example.com"),
        "education": resume_data.get("education", "Not Specified"),
        "skills": [
            {
                "skill_name": s.get("skill_name"),
                "category_code": s.get("category_code"),
                "evidence": s.get("evidence", "Extracted from resume"),
                "confidence": s.get("confidence", "medium")
            }
            for s in resume_data.get("skills", [])
        ],
        "hackathons": [],
        "internships": [],
        "certifications": [],
        "preferred_roles": [resume_data.get("role", "Candidate")] if resume_data.get("role") else []
    }
    
    # Validate with Pydantic model
    validated = Profile(**profile_data)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(validated.model_dump(), f, indent=2)
    print(f"      [OK] Struct profile created & saved to {output_path}")

def process_all_jds():
    print("\n[JD] Processing all Job Descriptions...")
    search_path = os.path.join(JD_FOLDER, "*.*")
    jd_files = glob.glob(search_path)
    
    processed_count = 0
    for jd_path in jd_files:
        filename = os.path.basename(jd_path)
        if not filename.endswith(('.txt', '.pdf', '.docx')):
            continue
        print(f"   --> Ingesting: {filename}")
        try:
            result = parse_jd_file(jd_path)
            # Validate with Pydantic model
            validated = ParsedOutput(**result)
            
            output_filename = os.path.join(DATA_FOLDER, f"jd_{os.path.splitext(filename)[0]}.json")
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(validated.model_dump(), f, indent=2)
            print(f"      [OK] Saved to {os.path.basename(output_filename)}")
            processed_count += 1
        except Exception as e:
            print(f"      [ERROR] Error: {e}")
            
    # Also save the last processed JD as the default "jd_output.json" for the UI
    if jd_files and processed_count > 0:
        # Find a successfully processed file
        for jd_path in reversed(jd_files):
            filename = os.path.basename(jd_path)
            try:
                last_jd = parse_jd_file(jd_path)
                validated = ParsedOutput(**last_jd)
                with open(os.path.join(DATA_FOLDER, "jd_output.json"), 'w', encoding='utf-8') as f:
                    json.dump(validated.model_dump(), f, indent=2)
                print(f"\n[OK] Default JD output initialized using {filename}")
                break
            except Exception:
                continue

def process_all_resumes():
    print("\n[RESUME] Processing all Resumes...")
    search_path = os.path.join(RESUME_FOLDER, "*.*")
    resume_files = glob.glob(search_path)
    
    processed_count = 0
    last_processed_data = None
    for resume_path in resume_files:
        filename = os.path.basename(resume_path)
        if not filename.endswith(('.txt', '.pdf', '.docx')):
            continue
        print(f"   --> Ingesting: {filename}")
        try:
            result = parse_resume_file(resume_path)
            output_filename = os.path.join(DATA_FOLDER, f"resume_{os.path.splitext(filename)[0]}.json")
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            print(f"      [OK] Saved to {os.path.basename(output_filename)}")
            
            # Let's save a profile.json preview for each resume
            profile_filename = os.path.join(DATA_FOLDER, f"profile_{os.path.splitext(filename)[0]}.json")
            create_profile_from_resume(result, profile_filename)
            
            processed_count += 1
            last_processed_data = result
        except Exception as e:
            print(f"      [ERROR] Error: {e}")
            
    # Save the last parsed resume & profile as the defaults for immediate matching in the UI
    if last_processed_data:
        with open(os.path.join(DATA_FOLDER, "resume_output.json"), 'w', encoding='utf-8') as f:
            json.dump(last_processed_data, f, indent=2)
        create_profile_from_resume(last_processed_data, os.path.join(DATA_FOLDER, "profile.json"))
        print(f"\n[OK] Default profile & resume initialized.")

if __name__ == "__main__":
    process_all_jds()
    process_all_resumes()
    print("\n[DONE] All sample documents ingested.")
