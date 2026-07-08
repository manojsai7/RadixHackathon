# RADIX Talent Match - REST API Integration Guide

This guide details the backend endpoints for each of the 5 roles, detailing how to query, parse, and verify candidate mappings.

The backend exposes a Flask API server running at `http://localhost:5000/api`.

---

## 🧩 1. Job Description Analytics (Role 1)

Parses raw Job Description documents (PDF, Word, or TXT) and returns structured skill requirements mapped onto RADIX category standards.

* **Endpoint:** `POST /api/parse_jd`
* **Content-Type:** `multipart/form-data` (for file upload) OR `application/json` (for selecting pre-loaded samples).
* **Payload Examples:**
  * **Option A: Custom File Upload**
    * Parameter: `file` (binary payload)
  * **Option B: Sample Select**
    * Parameter: `{"sample_name": "Google LLC - Software Engineer.docx"}`
* **cURL command:**
  ```bash
  curl -X POST http://localhost:5000/api/parse_jd -H "Content-Type: application/json" -d "{\\"sample_name\\": \\"Google LLC - Software Engineer.docx\\"}"
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "company": "Google LLC",
    "role": "Software Engineer",
    "skills": [
      {
        "skill_name": "Python",
        "category_code": "COD",
        "evidence": "Requires proficiency in Python development.",
        "confidence": "high"
      }
    ],
    "source_file": "Google LLC - Software Engineer.docx"
  }
  ```

---

## 🧩 2. Resume Ingestion & Parsing (Role 2)

Extracts candidate details, preferred roles, educational background, internships, and skillsets from resumes.

* **Endpoint:** `POST /api/parse_resume`
* **Content-Type:** `multipart/form-data` OR `application/json` (sample selection).
* **Payload Examples:**
  * **Option A: Custom File Upload**
    * Parameter: `file` (binary payload)
  * **Option B: Sample Select**
    * Parameter: `{"sample_name": "Resume-Systems_Generalist.txt"}`
* **cURL command:**
  ```bash
  curl -X POST http://localhost:5000/api/parse_resume -H "Content-Type: application/json" -d "{\\"sample_name\\": \\"Resume-Systems_Generalist.txt\\"}"
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "education": "M.S. in Computer Science",
    "skills": [
      {
        "skill_name": "C++",
        "category_code": "COD",
        "evidence": "Built high performance network protocols using C++",
        "confidence": "high"
      }
    ],
    "internships": ["Software Engineer Intern at Microsoft"],
    "hackathons": ["RADIX Hackathon 2026 Runner Up"],
    "certifications": ["AWS Certified Solutions Architect"],
    "preferred_roles": ["Software Engineer"],
    "source_file": "Resume-Systems_Generalist.txt"
  }
  ```

---

## 🧩 3. Save Candidate Profile (Role 3)

Manually adjusts, overrides, and saves candidate credentials in the current session.

* **Endpoint:** `POST /api/save_profile`
* **Content-Type:** `application/json`
* **Payload Example:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "education": "M.S. in Computer Science",
    "skills": [
      {
        "skill_name": "C++",
        "category_code": "COD",
        "evidence": "Built high performance network protocols using C++",
        "confidence": "high"
      }
    ],
    "internships": ["Software Engineer Intern at Microsoft"],
    "hackathons": ["RADIX Hackathon 2026 Runner Up"],
    "certifications": ["AWS Certified Solutions Architect"],
    "preferred_roles": ["Software Engineer"]
  }
  ```
* **cURL command:**
  ```bash
  curl -X POST http://localhost:5000/api/save_profile -H "Content-Type: application/json" -d "{\\"name\\": \\"Jane Doe\\", \\"email\\": \\"jane.doe@example.com\\", \\"education\\": \\"M.S.\\", \\"skills\\": [], \\"internships\\": [], \\"hackathons\\": [], \\"certifications\\": [], \\"preferred_roles\\": []}"
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "message": "Profile saved successfully",
    "profile": { ... }
  }
  ```

---

## 🧩 4. Company Talent Check (Role 4)

Compares current candidate skill proficiencies against structured benchmarks defined by specific companies and roles.

* **Endpoint:** `GET /api/talent_check`
* **Query Parameters:**
  * `company` (string, e.g. `Google`)
  * `role` (string, e.g. `Software Engineer`)
* **cURL command:**
  ```bash
  curl "http://localhost:5000/api/talent_check?company=Google&role=Software=Engineer"
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "company": "Google",
    "role": "Software Engineer",
    "readiness_score": 75,
    "skillset_gap": [
      {
        "category_code": "COD",
        "required_level": 8,
        "candidate_level": 9,
        "gap": false
      },
      {
        "category_code": "SYSD",
        "required_level": 7,
        "candidate_level": 4,
        "gap": true
      }
    ]
  }
  ```

---

## 🧩 5. Job Description Skill Matching (Role 5)

Performs exact keyword relevance checking comparing the parsed candidate skillset profile directly against the requirements parsed from the Job Description workspace.

* **Endpoint:** `GET /api/skill_match`
* **cURL command:**
  ```bash
  curl http://localhost:5000/api/skill_match
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "jd_source_file": "Google LLC - Software Engineer.docx",
    "match_score": 66,
    "matched_skills": ["Python", "C++", "SQL"],
    "missing_skills": ["Docker", "Kubernetes"]
  }
  ```

---

## 🔄 Session Control

### Reset Current Session
Clears active caches, reset parsed files, and wipes the current candidate profile.
* **Endpoint:** `POST /api/reset_session`
* **cURL command:**
  ```bash
  curl -X POST http://localhost:5000/api/reset_session
  ```
* **Success Response Schema (`200 OK`):**
  ```json
  {
    "message": "Session reset successfully"
  }
  ```
