import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Briefcase, 
  FileText, 
  User, 
  Award, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Check, 
  X, 
  Code, 
  Play, 
  CheckSquare, 
  AlertCircle, 
  Zap,
  Mail
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

// Types to match models.py
interface Skill {
  skill_name: string;
  category_code: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Profile {
  name: string;
  email: string;
  education: string;
  skills: Skill[];
  hackathons: string[];
  internships: string[];
  certifications: string[];
  preferred_roles: string[];
  cv_file?: string;
}

interface SkillsetGapItem {
  category_code: string;
  required_level: number;
  candidate_level: number;
  gap: boolean;
}

interface TalentCheckResult {
  company: string;
  role: string;
  skillset_gap: SkillsetGapItem[];
  readiness_score: number;
}

interface SkillMatchResult {
  jd_source_file: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
}

function App() {
  // Lists
  const [sampleJds, setSampleJds] = useState<string[]>([]);
  const [sampleResumes, setSampleResumes] = useState<string[]>([]);
  
  // Selection
  const [selectedJdSample, setSelectedJdSample] = useState('');
  const [selectedResumeSample, setSelectedResumeSample] = useState('');
  
  // Upload Files
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  
  // Parsing states
  const [jdLoading, setJdLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [jdParsedFile, setJdParsedFile] = useState('');
  const [resumeParsedFile, setResumeParsedFile] = useState('');
  const [jdSkillsCount, setJdSkillsCount] = useState(0);
  
  // Profile State
  const [profile, setProfile] = useState<Profile>({
    name: '',
    email: '',
    education: '',
    skills: [],
    hackathons: [],
    internships: [],
    certifications: [],
    preferred_roles: []
  });
  
  // Skill builder manual fields
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCat, setNewSkillCat] = useState('COD');
  const [newSkillConf, setNewSkillConf] = useState<'high' | 'medium' | 'low'>('medium');
  
  // Custom tag builders
  const [newHackathon, setNewHackathon] = useState('');
  const [newInternship, setNewInternship] = useState('');
  const [newCert, setNewCert] = useState('');
  const [newPrefRole, setNewPrefRole] = useState('');
  
  // Scoring parameters & states
  const [selectedCompany, setSelectedCompany] = useState('Google');
  const [selectedRole, setSelectedRole] = useState('Software Engineer');
  const [talentLoading, setTalentLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [talentResult, setTalentResult] = useState<TalentCheckResult | null>(null);
  const [matchResult, setMatchResult] = useState<SkillMatchResult | null>(null);
  
  // Notifications
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' | null }>({ text: '', type: null });

  // Modal pop-up states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);

  // Company - Role Mapping for dropdowns
  const companyRoles: Record<string, string[]> = {
    "Google": ["Software Engineer", "Data Scientist"],
    "Microsoft": ["Software Engineer", "Data Analyst"],
    "Oracle Financial Services Software": ["Associate Software Engineer", "Application Support Analyst"]
  };

  useEffect(() => {
    fetchSamples();
    fetchProfile();
  }, []);

  // Fetch lists of samples
  const fetchSamples = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_samples`);
      setSampleJds(res.data.jds || []);
      setSampleResumes(res.data.resumes || []);
      if (res.data.jds?.length > 0) setSelectedJdSample(res.data.jds[0]);
      if (res.data.resumes?.length > 0) setSelectedResumeSample(res.data.resumes[0]);
    } catch (err) {
      triggerAlert('Failed to load sample files list', 'error');
    }
  };

  // Fetch candidate profile
  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_profile`);
      if (res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      triggerAlert('Failed to load candidate profile', 'error');
    }
  };

  const triggerAlert = (text: string, type: 'info' | 'success' | 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => {
      setAlertMsg({ text: '', type: null });
    }, 5000);
  };

  // Parse JD File
  const handleParseJD = async () => {
    setJdLoading(true);
    triggerAlert('Ingesting and parsing Job Description...', 'info');
    try {
      let res;
      if (jdFile) {
        const formData = new FormData();
        formData.append('file', jdFile);
        res = await axios.post(`${API_BASE}/parse_jd`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (selectedJdSample) {
        res = await axios.post(`${API_BASE}/parse_jd`, { sample_name: selectedJdSample });
      } else {
        triggerAlert('Please upload a file or choose a sample JD', 'error');
        setJdLoading(false);
        return;
      }
      
      setJdParsedFile(res.data.source_file);
      setJdSkillsCount(res.data.skills?.length || 0);
      triggerAlert(`JD parsed successfully! Found ${res.data.skills?.length || 0} skills.`, 'success');
      
      // Auto-set company and role if parsed
      if (res.data.company && res.data.company !== 'Unknown' && companyRoles[res.data.company]) {
        setSelectedCompany(res.data.company);
        if (res.data.role && res.data.role !== 'Unknown') {
          // Check if role is in our map
          const matchedRole = companyRoles[res.data.company].find(
            r => r.toLowerCase().replace(/\s+/g, '') === res.data.role.toLowerCase().replace(/\s+/g, '')
          );
          if (matchedRole) setSelectedRole(matchedRole);
        }
      }
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Error parsing Job Description', 'error');
    } finally {
      setJdLoading(false);
    }
  };

  // Parse Resume File
  const handleParseResume = async () => {
    setResumeLoading(true);
    triggerAlert('Extracting skills from Resume...', 'info');
    try {
      let res;
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        res = await axios.post(`${API_BASE}/parse_resume`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (selectedResumeSample) {
        res = await axios.post(`${API_BASE}/parse_resume`, { sample_name: selectedResumeSample });
      } else {
        triggerAlert('Please upload a file or choose a sample Resume', 'error');
        setResumeLoading(false);
        return;
      }
      
      setResumeParsedFile(res.data.source_file || 'Sample Resume');
      triggerAlert('Resume parsed. Candidate profile pre-filled!', 'success');
      
      // Refresh profile to show loaded data
      await fetchProfile();
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Error parsing Resume', 'error');
    } finally {
      setResumeLoading(false);
    }
  };

  // Save Candidate Profile
  const handleSaveProfile = async () => {
    try {
      const res = await axios.post(`${API_BASE}/save_profile`, profile);
      setProfile(res.data.profile);
      triggerAlert('Candidate profile saved successfully!', 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Failed to save profile', 'error');
    }
  };

  // Run Talent Check
  const handleTalentCheck = async () => {
    setTalentLoading(true);
    triggerAlert(`Running Talent Check against ${selectedCompany}...`, 'info');
    try {
      const res = await axios.get(`${API_BASE}/talent_check`, {
        params: { company: selectedCompany, role: selectedRole }
      });
      setTalentResult(res.data);
      triggerAlert(`Talent Check completed! Readiness Score: ${res.data.readiness_score}%`, 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Talent Check failed', 'error');
    } finally {
      setTalentLoading(false);
    }
  };

  // Run Skill Match
  const handleSkillMatch = async () => {
    setMatchLoading(true);
    triggerAlert('Running Skill Match analysis...', 'info');
    try {
      const res = await axios.get(`${API_BASE}/skill_match`);
      setMatchResult(res.data);
      triggerAlert(`Skill Match computed! Match Score: ${res.data.match_score}%`, 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Skill Match failed. Ensure you parsed a JD and saved a profile first.', 'error');
    } finally {
      setMatchLoading(false);
    }
  };

  // Reset Session
  const handleResetSession = async () => {
    if (window.confirm("Are you sure you want to clear the session? This deletes all parsed cache.")) {
      try {
        await axios.post(`${API_BASE}/reset_session`);
        setJdFile(null);
        setResumeFile(null);
        setJdParsedFile('');
        setResumeParsedFile('');
        setJdSkillsCount(0);
        setTalentResult(null);
        setMatchResult(null);
        setProfile({
          name: '',
          email: '',
          education: '',
          skills: [],
          hackathons: [],
          internships: [],
          certifications: [],
          preferred_roles: []
        });
        triggerAlert('Session successfully reset!', 'success');
      } catch (err) {
        triggerAlert('Failed to reset session', 'error');
      }
    }
  };

  // Interactive Form Helpers
  const addSkill = () => {
    if (!newSkillName.trim()) return;
    const isDuplicate = profile.skills.some(
      s => s.skill_name.toLowerCase() === newSkillName.trim().toLowerCase()
    );
    if (isDuplicate) {
      triggerAlert('Skill already exists in profile', 'error');
      return;
    }
    const newSkill: Skill = {
      skill_name: newSkillName.trim(),
      category_code: newSkillCat,
      evidence: 'Manually added by candidate',
      confidence: newSkillConf
    };
    setProfile({
      ...profile,
      skills: [...profile.skills, newSkill]
    });
    setNewSkillName('');
  };

  const removeSkill = (index: number) => {
    const updated = [...profile.skills];
    updated.splice(index, 1);
    setProfile({ ...profile, skills: updated });
  };

  const updateSkillConfidence = (index: number, confidence: 'high' | 'medium' | 'low') => {
    const updated = [...profile.skills];
    updated[index].confidence = confidence;
    setProfile({ ...profile, skills: updated });
  };

  const addTag = (field: 'hackathons' | 'internships' | 'certifications' | 'preferred_roles', value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    if (profile[field].includes(value.trim())) return;
    setProfile({
      ...profile,
      [field]: [...profile[field], value.trim()]
    });
    setter('');
  };

  const removeTag = (field: 'hackathons' | 'internships' | 'certifications' | 'preferred_roles', index: number) => {
    const updated = [...profile[field]];
    updated.splice(index, 1);
    setProfile({ ...profile, [field]: updated });
  };

  // Render SVG Circular Meter
  const renderCircleMeter = (score: number, size = 120, strokeWidth = 8) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="circular-gauge" style={{ width: size, height: size }}>
        <svg>
          <defs>
            <linearGradient id="gradient-success" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <circle className="bg-ring" cx={size / 2} cy={size / 2} r={radius} />
          <circle 
            className="value-ring" 
            cx={size / 2} 
            cy={size / 2} 
            r={radius} 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="value-text">
          <span className="value-number">{score}%</span>
          <span className="value-label">Match</span>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">
            <Zap size={28} className="text-white" />
          </div>
          <div className="logo-text">
            <h1>RADIX Talent Match</h1>
            <p>Candidate Readiness & Skill Gap Analyzer Dashboard</p>
          </div>
        </div>
        <div>
          <button onClick={handleResetSession} className="btn btn-secondary btn-danger" style={{ width: 'auto' }}>
            <RefreshCw size={14} /> Reset Session
          </button>
        </div>
      </header>

      {/* ALERT NOTIFICATION PANEL */}
      {alertMsg.text && (
        <div className={`status-text-panel ${alertMsg.type === 'success' ? 'status-success' : alertMsg.type === 'error' ? 'status-info' : 'status-info'}`}>
          <AlertCircle size={16} />
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* DASHBOARD GRID */}
      <div className="dashboard-grid">
        
        {/* PANEL 1: DATA INGESTION */}
        <section className="glass-panel">
          <h2 className="section-title">
            <FileText size={18} className="text-purple-400" />
            1. Document Analytics
          </h2>
          
          {/* JOB DESCRIPTION WORKSPACE */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0' }}>Job Description Ingestion</h3>
            
            <div className="form-group">
              <label>Select Sample JD</label>
              <select 
                value={selectedJdSample} 
                onChange={(e) => {
                  setSelectedJdSample(e.target.value);
                  setJdFile(null);
                }} 
                className="select-input"
              >
                {sampleJds.map(jd => (
                  <option key={jd} value={jd}>{jd.replace('.txt', '').replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            
            <div className="upload-container">
              <label className="upload-label">Or upload custom file (TXT/PDF/DOCX)</label>
              <div 
                className={`dropzone ${jdFile ? 'active' : ''}`}
                onClick={() => document.getElementById('jd-file-input')?.click()}
              >
                <input 
                  id="jd-file-input" 
                  type="file" 
                  accept=".txt,.pdf,.docx" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setJdFile(e.target.files[0]);
                      setSelectedJdSample('');
                    }
                  }}
                />
                <Briefcase size={24} className="dropzone-icon" />
                {jdFile ? (
                  <p className="dropzone-filename"><Check size={14} /> {jdFile.name}</p>
                ) : (
                  <p>Click to select custom JD</p>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleParseJD} 
              disabled={jdLoading}
              className="btn btn-primary"
            >
              {jdLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Parse Job Description
            </button>
            
            {jdParsedFile && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', color: '#a7f3d0' }}>
                <Check size={12} style={{ marginRight: '0.25rem', inlineSize: 'auto' }} />
                Parsed: <strong>{jdParsedFile}</strong> ({jdSkillsCount} skills extracted)
              </div>
            )}
          </div>
          
          {/* RESUME WORKSPACE */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0' }}>Resume Ingestion</h3>
            
            <div className="form-group">
              <label>Select Sample Resume</label>
              <select 
                value={selectedResumeSample} 
                onChange={(e) => {
                  setSelectedResumeSample(e.target.value);
                  setResumeFile(null);
                }} 
                className="select-input"
              >
                {sampleResumes.map(res => (
                  <option key={res} value={res}>{res.replace('.txt', '').replace('Resume-', '').replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            
            <div className="upload-container">
              <label className="upload-label">Or upload custom Resume (TXT/PDF/DOCX)</label>
              <div 
                className={`dropzone ${resumeFile ? 'active' : ''}`}
                onClick={() => document.getElementById('resume-file-input')?.click()}
              >
                <input 
                  id="resume-file-input" 
                  type="file" 
                  accept=".txt,.pdf,.docx" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setResumeFile(e.target.files[0]);
                      setSelectedResumeSample('');
                    }
                  }}
                />
                <FileText size={24} className="dropzone-icon" />
                {resumeFile ? (
                  <p className="dropzone-filename"><Check size={14} /> {resumeFile.name}</p>
                ) : (
                  <p>Click to select custom Resume</p>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleParseResume} 
              disabled={resumeLoading}
              className="btn btn-primary"
            >
              {resumeLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Parse Resume
            </button>
            
            {resumeParsedFile && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', color: '#a7f3d0' }}>
                <Check size={12} style={{ marginRight: '0.25rem', inlineSize: 'auto' }} />
                Parsed: <strong>{resumeParsedFile}</strong> (Profile updated!)
              </div>
            )}
          </div>
        </section>

        {/* PANEL 2: PROFILE BUILDER */}
        <section className="glass-panel">
          <h2 className="section-title">
            <User size={18} className="text-purple-400" />
            2. Candidate Profile Builder
          </h2>

          <div className="profile-summary-card">
            {/* Avatar & Details */}
            <div className="profile-summary-header">
              <div className="profile-avatar">
                {profile.name ? profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'C'}
              </div>
              <div className="profile-basics">
                <h3>{profile.name || "Unnamed Candidate"}</h3>
                <p style={{ marginTop: '0.2rem' }}>
                  <Mail size={12} /> {profile.email || "No email provided"}
                </p>
                {profile.education && (
                  <p style={{ marginTop: '0.1rem', color: 'var(--text-secondary)' }}>
                    <Briefcase size={12} /> {profile.education}
                  </p>
                )}
              </div>
            </div>

            {/* Preferred Roles Display */}
            {profile.preferred_roles && profile.preferred_roles.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Preferred Roles:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {profile.preferred_roles.map((role, i) => (
                    <span key={i} className="badge badge-OTHER" style={{ fontSize: '0.75rem' }}>{role}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stat Counters */}
            <div className="profile-stat-grid">
              <div className="profile-stat-box">
                <strong>{profile.skills?.length || 0}</strong>
                Parsed Skills
              </div>
              <div className="profile-stat-box">
                <strong>{profile.certifications?.length || 0}</strong>
                Certifications
              </div>
              <div className="profile-stat-box">
                <strong>{profile.internships?.length || 0}</strong>
                Internships
              </div>
              <div className="profile-stat-box">
                <strong>{profile.hackathons?.length || 0}</strong>
                Hackathons
              </div>
            </div>

            {/* Actions to trigger modals */}
            <div className="profile-actions-grid">
              <button onClick={() => setShowInfoModal(true)} className="btn btn-secondary">
                Edit Details
              </button>
              <button onClick={() => setShowSkillsModal(true)} className="btn btn-secondary">
                Manage Skills
              </button>
              <button onClick={() => setShowActivitiesModal(true)} className="btn btn-secondary" style={{ gridColumn: 'span 2' }}>
                Manage Experiences & Certs
              </button>
            </div>

            <button 
              onClick={handleSaveProfile} 
              className="btn btn-primary" 
              style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}
            >
              <CheckSquare size={14} /> Save Profile & Update Skills
            </button>
          </div>

          {/* ---------- MODAL 1: EDIT DETAILS ---------- */}
          {showInfoModal && (
            <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Edit Personal Information</h3>
                  <button className="modal-close-btn" onClick={() => setShowInfoModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Name</label>
                    <input 
                      type="text" 
                      value={profile.name} 
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
                      className="text-input"
                      placeholder="Candidate Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input 
                      type="email" 
                      value={profile.email} 
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })} 
                      className="text-input"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Education</label>
                    <input 
                      type="text" 
                      value={profile.education} 
                      onChange={(e) => setProfile({ ...profile, education: e.target.value })} 
                      className="text-input"
                      placeholder="Degree, Institution"
                    />
                  </div>
                  <div className="form-group">
                    <label>Preferred Roles</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.preferred_roles.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', color: '#c7d2fe' }}>
                          {tag}
                          <button onClick={() => removeTag('preferred_roles', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {profile.preferred_roles.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No preferred roles added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newPrefRole} 
                        onChange={(e) => setNewPrefRole(e.target.value)} 
                        className="text-input" 
                        placeholder="Add Preferred Role (e.g. Software Engineer)"
                        style={{ padding: '0.45rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('preferred_roles', newPrefRole, setNewPrefRole)}
                      />
                      <button onClick={() => addTag('preferred_roles', newPrefRole, setNewPrefRole)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button onClick={() => setShowInfoModal(false)} className="btn btn-primary">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- MODAL 2: MANAGE SKILLS ---------- */}
          {showSkillsModal && (
            <div className="modal-overlay" onClick={() => setShowSkillsModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Manage Profile Skillset</h3>
                  <button className="modal-close-btn" onClick={() => setShowSkillsModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="text-input"
                      placeholder="Skill name"
                      onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                    />
                    <select 
                      value={newSkillCat} 
                      onChange={(e) => setNewSkillCat(e.target.value)} 
                      className="select-input"
                    >
                      {["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select 
                      value={newSkillConf} 
                      onChange={(e) => setNewSkillConf(e.target.value as any)} 
                      className="select-input"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button onClick={addSkill} className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem' }}><Plus size={14} /></button>
                  </div>

                  <div className="skills-list-editor" style={{ maxHeight: '400px' }}>
                    {profile.skills.map((skill, idx) => (
                      <div key={idx} className="skill-edit-item">
                        <div className="skill-info-block">
                          <span className="skill-info-name">{skill.skill_name}</span>
                          <span className={`badge badge-${skill.category_code}`} style={{ display: 'inline-block', width: 'fit-content', marginTop: '0.2rem' }}>{skill.category_code}</span>
                        </div>
                        <div className="skill-meta-block">
                          <select 
                            value={skill.confidence} 
                            onChange={(e) => updateSkillConfidence(idx, e.target.value as any)}
                            className="skill-confidence-select"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <button onClick={() => removeSkill(idx)} className="skill-delete-btn"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                    {profile.skills.length === 0 && (
                      <div className="empty-state">
                        <Code size={18} className="empty-state-icon" />
                        <p>No skills listed in profile. Add skills manually above.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button onClick={() => setShowSkillsModal(false)} className="btn btn-primary">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------- MODAL 3: MANAGE EXPERIENCES & CERTS ---------- */}
          {showActivitiesModal && (
            <div className="modal-overlay" onClick={() => setShowActivitiesModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Manage Experiences & Certifications</h3>
                  <button className="modal-close-btn" onClick={() => setShowActivitiesModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Internships Tag Manager */}
                  <div className="form-group">
                    <label>Internships</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.internships.map((tag, i) => (
                        <span key={i} className="profile-tag">
                          {tag}
                          <button onClick={() => removeTag('internships', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {profile.internships.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No internships added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newInternship} 
                        onChange={(e) => setNewInternship(e.target.value)} 
                        className="text-input" 
                        placeholder="Add Internship details"
                        style={{ padding: '0.45rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('internships', newInternship, setNewInternship)}
                      />
                      <button onClick={() => addTag('internships', newInternship, setNewInternship)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Hackathons Tag Manager */}
                  <div className="form-group">
                    <label>Hackathons</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.hackathons.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0' }}>
                          {tag}
                          <button onClick={() => removeTag('hackathons', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {profile.hackathons.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No hackathons added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newHackathon} 
                        onChange={(e) => setNewHackathon(e.target.value)} 
                        className="text-input" 
                        placeholder="Add Hackathon"
                        style={{ padding: '0.45rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('hackathons', newHackathon, setNewHackathon)}
                      />
                      <button onClick={() => addTag('hackathons', newHackathon, setNewHackathon)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                    </div>
                  </div>

                  {/* Certifications Tag Manager */}
                  <div className="form-group">
                    <label>Certifications</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.certifications.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fde68a' }}>
                          {tag}
                          <button onClick={() => removeTag('certifications', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {profile.certifications.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No certifications added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newCert} 
                        onChange={(e) => setNewCert(e.target.value)} 
                        className="text-input" 
                        placeholder="Add Certification"
                        style={{ padding: '0.45rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('certifications', newCert, setNewCert)}
                      />
                      <button onClick={() => addTag('certifications', newCert, setNewCert)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                    </div>
                  </div>

                </div>
                <div className="modal-footer">
                  <button onClick={() => setShowActivitiesModal(false)} className="btn btn-primary">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* PANEL 3: DIAGNOSTICS & VERIFICATION */}
        <section className="glass-panel results-grid">
          
          {/* TALENT CHECK DIAGNOSTICS */}
          <div className="glass-panel" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem' }}>
            <h2 className="section-title">
              <Award size={18} className="text-purple-400" />
              3. Company Talent Check
            </h2>
            
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Target Company</label>
                <select 
                  value={selectedCompany} 
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    // Update role default based on company
                    setSelectedRole(companyRoles[e.target.value][0]);
                  }} 
                  className="select-input"
                >
                  <option value="Google">Google</option>
                  <option value="Microsoft">Microsoft</option>
                  <option value="Oracle Financial Services Software">Oracle Financial Services Software</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Target Role</label>
                <select 
                  value={selectedRole} 
                  onChange={(e) => setSelectedRole(e.target.value)} 
                  className="select-input"
                >
                  {companyRoles[selectedCompany]?.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <button 
              onClick={handleTalentCheck} 
              disabled={talentLoading}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}
            >
              {talentLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Analyze Readiness Bar
            </button>
            
            {talentResult ? (
              <div style={{ marginTop: '1.25rem' }}>
                <div className="talent-check-header">
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 650 }}>{talentResult.company}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{talentResult.role}</p>
                  </div>
                  <div className="talent-score-badge">
                    {talentResult.readiness_score}% Fit
                  </div>
                </div>
                
                {/* 12 Skillset Gap Grid */}
                <div className="gap-analyzer-list">
                  {talentResult.skillset_gap.map((item, i) => (
                    <div key={i} className="gap-item">
                      <div className="gap-item-title">
                        <span className={`badge badge-${item.category_code}`}>{item.category_code}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Cand: {item.candidate_level} / Req: {item.required_level}
                          </span>
                          <span className="gap-status-tag">
                            {item.gap ? (
                              <span className="status-cross"><X size={10} /> GAP</span>
                            ) : (
                              <span className="status-check"><Check size={10} /> READY</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="level-indicator-bar">
                        <div 
                          className="level-indicator-fill-cand" 
                          style={{ width: `${item.candidate_level * 10}%`, background: item.gap ? 'var(--danger)' : 'var(--success)' }} 
                        />
                        <div 
                          className="level-indicator-fill-req" 
                          style={{ width: `${item.required_level * 10}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <AlertCircle size={24} className="empty-state-icon" />
                <p>Run Talent Check to see candidate readiness compared against the company skillset standards.</p>
              </div>
            )}
          </div>
          
          {/* JOB SPECIFIC SKILL MATCHING */}
          <div className="glass-panel" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem' }}>
            <h2 className="section-title">
              <Briefcase size={18} className="text-purple-400" />
              4. Job Skill Matching
            </h2>
            
            <button 
              onClick={handleSkillMatch} 
              disabled={matchLoading}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              {matchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Run Skill Match Check
            </button>
            
            {matchResult ? (
              <div style={{ marginTop: '1.25rem' }}>
                <div className="skill-match-container">
                  {renderCircleMeter(matchResult.match_score)}
                  <div className="match-breakdown-details">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Target Source File:
                    </p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 650, color: 'white', wordBreak: 'break-all' }}>
                      {matchResult.jd_source_file}
                    </p>
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Matched Skills ({matchResult.matched_skills.length})</h4>
                  <div className="skill-chips-list">
                    {matchResult.matched_skills.map((skill, i) => (
                      <span key={i} className="chip chip-matched">{skill}</span>
                    ))}
                    {matchResult.matched_skills.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None matched</span>}
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Missing / Gaps ({matchResult.missing_skills.length})</h4>
                  <div className="skill-chips-list">
                    {matchResult.missing_skills.map((skill, i) => (
                      <span key={i} className="chip chip-missing">{skill}</span>
                    ))}
                    {matchResult.missing_skills.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None missing</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <AlertCircle size={24} className="empty-state-icon" />
                <p>Ensure you have parsed a Job Description and built a profile, then run the Skill Match to analyze alignment.</p>
              </div>
            )}
          </div>
        </section>
        
      </div>
    </div>
  );
}

export default App;
