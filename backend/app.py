import os
import json
import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import models & modules
from models import Profile, ParsedOutput, TalentCheckResult, SkillMatchResult
from parse_jd import parse_jd_file
from parse_resume import parse_resume_file
from talent_check import compute_talent_check, load_candidate_profile
from skill_match import compute_skill_match, load_jd_skills, load_profile_skills

app = Flask(__name__)
# Enable CORS for all routes and origins (port 5173 is standard for Vite)
CORS(app, resources={r"/api/*": {"origins": "*"}})

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
DATA_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SAMPLE_JDS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_inputs', 'jds')
SAMPLE_RESUMES_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_inputs', 'resumes')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)
os.makedirs(SAMPLE_JDS_FOLDER, exist_ok=True)
os.makedirs(SAMPLE_RESUMES_FOLDER, exist_ok=True)

# Helper to load JSON file if it exists, otherwise return default dict
def load_json_file(filename: str, default_val: any = None) -> any:
    path = os.path.join(DATA_FOLDER, filename)
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return default_val if default_val is not None else {}

# Helper to save JSON file
def save_json_file(filename: str, data: any):
    path = os.path.join(DATA_FOLDER, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

# ---------- ENDPOINTS ----------

@app.route('/api/get_samples', methods=['GET'])
def get_samples():
    """Returns a list of pre-configured sample files for easy testing in the UI."""
    jds = []
    if os.path.exists(SAMPLE_JDS_FOLDER):
        jds = [f for f in os.listdir(SAMPLE_JDS_FOLDER) if f.endswith(('.txt', '.pdf', '.docx'))]
        
    resumes = []
    if os.path.exists(SAMPLE_RESUMES_FOLDER):
        resumes = [f for f in os.listdir(SAMPLE_RESUMES_FOLDER) if f.endswith(('.txt', '.pdf', '.docx'))]
        
    return jsonify({
        "jds": jds,
        "resumes": resumes
    })

@app.route('/api/parse_jd', methods=['POST'])
def parse_jd():
    # Check if we are parsing an uploaded file or a sample file
    filepath = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
    elif 'sample_name' in request.json:
        sample_name = request.json['sample_name']
        filepath = os.path.join(SAMPLE_JDS_FOLDER, secure_filename(sample_name))
        if not os.path.exists(filepath):
            return jsonify({'error': f'Sample file {sample_name} not found'}), 404
            
    if not filepath:
        return jsonify({'error': 'No file uploaded or sample name specified'}), 400
        
    try:
        result = parse_jd_file(filepath)
        # Validate against ParsedOutput model
        validated = ParsedOutput(**result)
        save_json_file('jd_output.json', validated.model_dump())
        return jsonify(validated.model_dump())
    except Exception as e:
        return jsonify({'error': f'Parsing failed: {str(e)}'}), 500

@app.route('/api/parse_resume', methods=['POST'])
def parse_resume():
    filepath = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
    elif 'sample_name' in request.json:
        sample_name = request.json['sample_name']
        filepath = os.path.join(SAMPLE_RESUMES_FOLDER, secure_filename(sample_name))
        if not os.path.exists(filepath):
            return jsonify({'error': f'Sample file {sample_name} not found'}), 404
            
    if not filepath:
        return jsonify({'error': 'No file uploaded or sample name specified'}), 400
        
    try:
        result = parse_resume_file(filepath)
        # Save parsed resume to resume_output.json
        save_json_file('resume_output.json', result)
        
        # Prefill profile.json automatically from this parsed resume
        profile_data = {
            "name": result.get("name", "Unknown Candidate"),
            "email": result.get("email", "unknown@example.com"),
            "education": result.get("education", "Not Specified"),
            "skills": result.get("skills", []),
            "hackathons": [],
            "internships": [],
            "certifications": [],
            "preferred_roles": [result.get("role", "Candidate")] if result.get("role") else [],
            "cv_file": os.path.basename(filepath)
        }
        validated_profile = Profile(**profile_data)
        save_json_file('profile.json', validated_profile.model_dump())
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Parsing failed: {str(e)}'}), 500

@app.route('/api/save_profile', methods=['POST'])
def save_profile():
    profile_data = request.get_json()
    if not profile_data:
        return jsonify({'error': 'No profile data received'}), 400
    try:
        # Validate profile with Pydantic
        profile = Profile(**profile_data)
        save_json_file('profile.json', profile.model_dump())
        return jsonify({'status': 'saved', 'profile': profile.model_dump()})
    except Exception as e:
        return jsonify({'error': f'Invalid profile data: {str(e)}'}), 400

@app.route('/api/get_profile', methods=['GET'])
def get_profile():
    profile = load_json_file('profile.json', default_val=None)
    if profile:
        return jsonify(profile)
    else:
        # return empty profile matching schema
        empty_profile = Profile()
        return jsonify(empty_profile.model_dump())

@app.route('/api/talent_check', methods=['GET'])
def talent_check():
    company = request.args.get('company')
    role = request.args.get('role')
    
    if not company:
        return jsonify({'error': 'Company name required'}), 400
        
    profile_path = os.path.join(DATA_FOLDER, 'profile.json')
    if not os.path.exists(profile_path):
        return jsonify({'error': 'No profile saved. Please save a profile first.'}), 400
        
    profile = load_candidate_profile(profile_path)
    
    try:
        result = compute_talent_check(company, role, profile)
        # Validate against TalentCheckResult Pydantic schema
        validated = TalentCheckResult(**result)
        save_json_file('talent_check_output.json', validated.model_dump())
        return jsonify(validated.model_dump())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/skill_match', methods=['GET'])
def skill_match():
    jd_path = os.path.join(DATA_FOLDER, 'jd_output.json')
    profile_path = os.path.join(DATA_FOLDER, 'profile.json')
    
    if not os.path.exists(jd_path):
        return jsonify({'error': 'No parsed Job Description found. Please parse a JD first.'}), 400
    if not os.path.exists(profile_path):
        return jsonify({'error': 'No profile saved. Please save a profile first.'}), 400
        
    jd_skills = load_jd_skills(jd_path)
    profile_skills = load_profile_skills(profile_path)
    
    try:
        # Retrieve the source file from cached JD output
        with open(jd_path, 'r', encoding='utf-8') as f:
            jd_data = json.load(f)
            jd_source = jd_data.get("source_file", "unknown_jd.json")
            
        result = compute_skill_match(jd_skills, profile_skills)
        result["jd_source_file"] = jd_source
        
        # Validate against SkillMatchResult model
        validated = SkillMatchResult(**result)
        save_json_file('skill_match_output.json', validated.model_dump())
        return jsonify(validated.model_dump())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/reset_session', methods=['POST'])
def reset_session():
    """Clears all parsed and cached data to reset the user workflow."""
    files_to_delete = ['profile.json', 'jd_output.json', 'resume_output.json', 'talent_check_output.json', 'skill_match_output.json']
    for file in files_to_delete:
        path = os.path.join(DATA_FOLDER, file)
        if os.path.exists(path):
            os.remove(path)
            
    # Clear upload files
    if os.path.exists(UPLOAD_FOLDER):
        for filename in os.listdir(UPLOAD_FOLDER):
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            try:
                if os.path.isfile(filepath) or os.path.islink(filepath):
                    os.unlink(filepath)
                elif os.path.isdir(filepath):
                    shutil.rmtree(filepath)
            except Exception as e:
                print(f'Failed to delete {filepath}. Reason: {e}')
                
    return jsonify({'status': 'reset_successful'})

if __name__ == '__main__':
    # Running on local port 5000
    app.run(debug=True, port=5000)
