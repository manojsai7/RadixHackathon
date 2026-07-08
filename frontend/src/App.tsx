import { useState, useEffect, useRef } from 'react';
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
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

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
  const mainRef = useRef<HTMLDivElement>(null);
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

  // Step Navigation & Chart Interactive States
  const [step, setStep] = useState(1);
  const [talentFilter, setTalentFilter] = useState<'all' | 'ready' | 'gap'>('all');
  const [hoveredMatchSegment, setHoveredMatchSegment] = useState<'all' | 'matched' | 'missing'>('all');
  const contentRef = useRef<HTMLDivElement>(null);

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

  // 1. Entrance staggered animation for glass panels on load
  useGSAP(() => {
    gsap.from(".glass-panel", {
      opacity: 0,
      y: 40,
      duration: 0.8,
      stagger: 0.12,
      ease: "power2.out"
    });
  }, { scope: mainRef });

  // GSAP animation for step switching
  useGSAP(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [step]);

  // 2. Animate Talent Check bars & scores on updates
  useGSAP(() => {
    if (talentResult) {
      // Reset width first to trigger fresh animations on update
      gsap.set(".level-indicator-fill-cand", { width: "0%" });
      gsap.set(".level-indicator-fill-req", { width: "0%" });

      // Animate candidate levels
      gsap.to(".level-indicator-fill-cand", {
        width: (_, target) => target.getAttribute('data-width') + "%",
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.03
      });

      // Animate required baselines
      gsap.to(".level-indicator-fill-req", {
        width: (_, target) => target.getAttribute('data-width') + "%",
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.02
      });

      // Count up score numbers
      const scoreValueEl = document.querySelector(".talent-score-value");
      if (scoreValueEl) {
        const valObj = { val: 0 };
        gsap.to(valObj, {
          val: talentResult.readiness_score,
          duration: 1.4,
          snap: { val: 1 },
          ease: "power2.out",
          onUpdate: () => {
            scoreValueEl.textContent = valObj.val + "%";
          }
        });
      }
    }
  }, [talentResult]);

  // 3. Animate Skill Match progress ring, stagger chips & count up score
  useGSAP(() => {
    if (matchResult) {
      // Circular Match Ring Draw
      const ring = document.querySelector(".value-ring") as SVGPathElement | null;
      if (ring) {
        const circumference = parseFloat(ring.getAttribute("data-circumference") || "0");
        const targetOffset = parseFloat(ring.getAttribute("data-offset") || "0");
        
        // Reset to full dashoffset (0% filled)
        gsap.set(ring, { strokeDashoffset: circumference });
        
        gsap.to(ring, {
          strokeDashoffset: targetOffset,
          duration: 1.6,
          ease: "power3.out"
        });
      }

      // Match Score Counter
      const matchScoreEl = document.querySelector(".match-score-number");
      if (matchScoreEl) {
        const matchObj = { val: 0 };
        gsap.to(matchObj, {
          val: matchResult.match_score,
          duration: 1.6,
          snap: { val: 1 },
          ease: "power2.out",
          onUpdate: () => {
            matchScoreEl.textContent = matchObj.val + "%";
          }
        });
      }

      // Matched and Missing Chips stagger slide-in
      gsap.from(".chip-matched", {
        opacity: 0,
        x: -15,
        duration: 0.5,
        stagger: 0.03,
        ease: "power1.out"
      });

      gsap.from(".chip-missing", {
        opacity: 0,
        x: 15,
        duration: 0.5,
        stagger: 0.03,
        ease: "power1.out"
      });
    }
  }, [matchResult]);

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
            strokeDashoffset={circumference}
            data-offset={offset}
            data-circumference={circumference}
            style={{ stroke: 'var(--primary)' }}
          />
        </svg>
        <div className="value-text">
          <span className="value-number match-score-number">0%</span>
          <span className="value-label">Match</span>
        </div>
      </div>
    );
  };

  // Render SVG Talent Doughnut Chart
  const renderTalentDonut = (result: TalentCheckResult) => {
    const total = result.skillset_gap.length;
    const gaps = result.skillset_gap.filter(item => item.gap).length;
    const ready = total - gaps;
    
    // Circle parameters (Radius 36, Circumference 226.195)
    const radius = 36;
    const circ = 2 * Math.PI * radius;
    
    const readyStrokeOffset = circ - (ready / total) * circ;
    const gapStrokeOffset = circ - (gaps / total) * circ;
    
    return (
      <div className="talent-donut-chart-container" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '1rem', 
        padding: '1.25rem', 
        background: 'rgba(255,255,255,0.01)', 
        borderRadius: '12px', 
        border: '1px solid rgba(255,255,255,0.03)', 
        marginBottom: '1.5rem' 
      }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Skill Categories Distribution</h4>
        
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle cx="60" cy="60" r={radius} fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="8" />
            
            {/* Ready segment */}
            <circle 
              cx="60" 
              cy="60" 
              r={radius} 
              fill="transparent" 
              stroke="var(--primary)" 
              strokeWidth="8" 
              strokeDasharray={circ} 
              strokeDashoffset={readyStrokeOffset} 
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            
            {/* Gaps segment */}
            <circle 
              cx="60" 
              cy="60" 
              r={radius} 
              fill="transparent" 
              stroke="var(--secondary)" 
              strokeWidth="8" 
              strokeDasharray={circ} 
              strokeDashoffset={gapStrokeOffset} 
              strokeLinecap="round"
              style={{ 
                transition: 'stroke-dashoffset 0.8s ease',
                transform: `rotate(${(ready / total) * 360}deg)`,
                transformOrigin: '60px 60px'
              }}
            />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', fontFamily: 'Outfit' }}>{ready}/{total}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Ready</span>
          </div>
        </div>
        
        {/* Legends & Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
          <button 
            onClick={() => setTalentFilter('all')} 
            className={`btn btn-secondary ${talentFilter === 'all' ? 'active' : ''}`}
            style={{ 
              padding: '0.35rem 0.65rem', 
              fontSize: '0.75rem', 
              borderRadius: '20px', 
              background: talentFilter === 'all' ? 'rgba(224, 169, 109, 0.1)' : 'transparent',
              borderColor: talentFilter === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)'
            }}
          >
            All ({total})
          </button>
          
          <button 
            onClick={() => setTalentFilter('ready')} 
            className={`btn btn-secondary ${talentFilter === 'ready' ? 'active' : ''}`}
            style={{ 
              padding: '0.35rem 0.65rem', 
              fontSize: '0.75rem', 
              borderRadius: '20px', 
              color: 'var(--primary)',
              background: talentFilter === 'ready' ? 'rgba(224, 169, 109, 0.1)' : 'transparent',
              borderColor: talentFilter === 'ready' ? 'var(--primary)' : 'rgba(255,255,255,0.05)'
            }}
          >
            Ready ({ready})
          </button>
          
          <button 
            onClick={() => setTalentFilter('gap')} 
            className={`btn btn-secondary ${talentFilter === 'gap' ? 'active' : ''}`}
            style={{ 
              padding: '0.35rem 0.65rem', 
              fontSize: '0.75rem', 
              borderRadius: '20px', 
              color: 'var(--secondary)',
              background: talentFilter === 'gap' ? 'rgba(185, 116, 85, 0.1)' : 'transparent',
              borderColor: talentFilter === 'gap' ? 'var(--secondary)' : 'rgba(255,255,255,0.05)'
            }}
          >
            Gaps ({gaps})
          </button>
        </div>
      </div>
    );
  };


  return (
    <div className="app-layout" ref={mainRef}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Zap size={24} style={{ color: 'var(--primary)' }} />
            <h1>RADIX Talent</h1>
          </div>
          
          <nav className="sidebar-nav">
            <button 
              className={`sidebar-btn ${step === 1 ? 'active' : ''}`}
              onClick={() => setStep(1)}
            >
              <FileText size={16} />
              <span>1. Documents</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 2 ? 'active' : ''}`}
              onClick={() => setStep(2)}
            >
              <User size={16} />
              <span>2. Profile Builder</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 3 ? 'active' : ''}`}
              onClick={() => setStep(3)}
            >
              <Award size={16} />
              <span>3. Talent Check</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 4 ? 'active' : ''}`}
              onClick={() => setStep(4)}
            >
              <Briefcase size={16} />
              <span>4. Skill Match</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 5 ? 'active' : ''}`}
              onClick={() => setStep(5)}
            >
              <Code size={16} />
              <span>5. Summary Flow</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator-box">
            <div className={`status-dot-line ${jdParsedFile ? 'active' : ''}`}>
              <div className={`status-dot-light ${jdParsedFile ? 'active' : ''}`} />
              <span>JD: {jdParsedFile ? 'Parsed' : 'Missing'}</span>
            </div>
            <div className={`status-dot-line ${resumeParsedFile ? 'active' : ''}`}>
              <div className={`status-dot-light ${resumeParsedFile ? 'active' : ''}`} />
              <span>Resume: {resumeParsedFile ? 'Parsed' : 'Missing'}</span>
            </div>
          </div>
          
          <button 
            onClick={handleResetSession} 
            className="btn btn-secondary btn-danger" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.6rem' }}
          >
            <RefreshCw size={12} /> Reset Session
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="main-workspace">
        {/* Alert Notification inside main space */}
        {alertMsg.text && (
          <div className={`status-text-panel ${alertMsg.type === 'success' ? 'status-success' : alertMsg.type === 'error' ? 'status-info' : 'status-info'}`} style={{ margin: 0 }}>
            <AlertCircle size={16} />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <div className="step-container" ref={contentRef}>
          {/* STEP 1: DOCUMENTS */}
          {step === 1 && (
            <div className="step-container">
              <div className="step-header">
                <h2>1. Document Analytics & Ingestion</h2>
                <p>Upload a job description and a resume, or choose from our sample sets to extract structured skills and technologies.</p>
              </div>
              <div className="side-by-side-grid">
                {/* Job Description Workspace */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <Briefcase size={16} style={{ color: 'var(--primary)' }} />
                    Job Description Ingestion
                  </h3>
                  
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
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
                  >
                    {jdLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Parse Job Description
                  </button>
                  
                  {jdParsedFile && (
                    <div style={{ marginTop: '0.75rem', background: 'rgba(224, 169, 109, 0.05)', border: '1px solid rgba(224, 169, 109, 0.15)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', color: '#eed1b0' }}>
                      <Check size={12} style={{ marginRight: '0.25rem', inlineSize: 'auto' }} />
                      Parsed: <strong>{jdParsedFile}</strong> ({jdSkillsCount} skills extracted)
                    </div>
                  )}
                </section>

                {/* Resume Ingestion Workspace */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <FileText size={16} style={{ color: 'var(--primary)' }} />
                    Resume Ingestion
                  </h3>
                  
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
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
                  >
                    {resumeLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Parse Resume
                  </button>
                  
                  {resumeParsedFile && (
                    <div style={{ marginTop: '0.75rem', background: 'rgba(224, 169, 109, 0.05)', border: '1px solid rgba(224, 169, 109, 0.15)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8rem', color: '#eed1b0' }}>
                      <Check size={12} style={{ marginRight: '0.25rem', inlineSize: 'auto' }} />
                      Parsed: <strong>{resumeParsedFile}</strong> (Profile updated!)
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* STEP 2: PROFILE BUILDER */}
          {step === 2 && (
            <div className="step-container">
              <div className="step-header">
                <h2>2. Candidate Profile Builder</h2>
                <p>Customize candidate profile details, edit parsed skills, confidence levels, and credentials manually.</p>
              </div>
              <div className="side-by-side-grid">
                
                {/* Personal Information & Credentials Form */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <User size={16} style={{ color: 'var(--primary)' }} />
                    Personal Details & Credentials
                  </h3>
                  
                  <div className="form-group">
                    <label>Candidate Name</label>
                    <input 
                      type="text" 
                      value={profile.name} 
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
                      className="text-input"
                      placeholder="Name"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email Address</label>
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
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Preferred Roles</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.preferred_roles.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(224, 169, 109, 0.3)', color: '#eed1b0' }}>
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
                        placeholder="Add Preferred Role"
                        style={{ padding: '0.45rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('preferred_roles', newPrefRole, setNewPrefRole)}
                      />
                      <button onClick={() => addTag('preferred_roles', newPrefRole, setNewPrefRole)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
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

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>Hackathons & Certs</label>
                    <div className="tag-container" style={{ marginBottom: '0.5rem' }}>
                      {profile.hackathons.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(185, 116, 85, 0.3)', color: '#dcb09c' }}>
                          {tag}
                          <button onClick={() => removeTag('hackathons', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {profile.certifications.map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(212, 175, 55, 0.3)', color: '#eedca2' }}>
                          {tag}
                          <button onClick={() => removeTag('certifications', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {(profile.hackathons.length === 0 && profile.certifications.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No hackathons/certs added</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div className="tag-input-wrapper" style={{ flex: 1 }}>
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
                      <div className="tag-input-wrapper" style={{ flex: 1 }}>
                        <input 
                          type="text" 
                          value={newCert} 
                          onChange={(e) => setNewCert(e.target.value)} 
                          className="text-input" 
                          placeholder="Add Cert"
                          style={{ padding: '0.45rem' }}
                          onKeyDown={(e) => e.key === 'Enter' && addTag('certifications', newCert, setNewCert)}
                        />
                        <button onClick={() => addTag('certifications', newCert, setNewCert)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem' }}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveProfile} 
                    className="btn btn-primary" 
                    style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}
                  >
                    <CheckSquare size={14} /> Save Profile & Update Skills
                  </button>
                </section>

                {/* Skills Manager Panel */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <Code size={16} style={{ color: 'var(--primary)' }} />
                    Manage Candidate Skills ({profile.skills?.length || 0})
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.4rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="text-input"
                      placeholder="Skill name"
                      onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                      style={{ padding: '0.45rem' }}
                    />
                    <select 
                      value={newSkillCat} 
                      onChange={(e) => setNewSkillCat(e.target.value)} 
                      className="select-input"
                      style={{ padding: '0.45rem' }}
                    >
                      {["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select 
                      value={newSkillConf} 
                      onChange={(e) => setNewSkillConf(e.target.value as any)} 
                      className="select-input"
                      style={{ padding: '0.45rem' }}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button onClick={addSkill} className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 0.65rem' }}><Plus size={14} /></button>
                  </div>

                  <div className="skills-list-editor" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    {profile.skills.map((skill, idx) => (
                      <div key={idx} className="skill-edit-item" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
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
                      <div className="empty-state" style={{ padding: '2rem 0' }}>
                        <Code size={24} className="empty-state-icon" />
                        <p>No skills added yet. Parse a resume or use the editor to add manually.</p>
                      </div>
                    )}
                  </div>
                </section>

              </div>
            </div>
          )}

          {/* STEP 3: TALENT CHECK */}
          {step === 3 && (
            <div className="step-container">
              <div className="step-header">
                <h2>3. Company Talent Check Analyzer</h2>
                <p>Select target corporate benchmarks to match the candidate's profile level indicators against industry expectations.</p>
              </div>

              <div className="side-by-side-grid">
                
                {/* Company & Role Selector */}
                <section className="glass-panel" style={{ margin: 0, alignSelf: 'start' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <Award size={16} style={{ color: 'var(--primary)' }} />
                    Select Target Profile
                  </h3>

                  <div className="form-group">
                    <label>Target Company</label>
                    <select 
                      value={selectedCompany} 
                      onChange={(e) => {
                        setSelectedCompany(e.target.value);
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

                  <button 
                    onClick={handleTalentCheck} 
                    disabled={talentLoading}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', marginTop: '1rem' }}
                  >
                    {talentLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Analyze Readiness Bar
                  </button>
                </section>

                {/* Talent Check Results */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  {talentResult ? (
                    <div>
                      <div className="talent-check-header" style={{ marginBottom: '1.5rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>{talentResult.company}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{talentResult.role} Baseline</p>
                        </div>
                        <div className="talent-score-badge" style={{ padding: '0.5rem 1rem', borderRadius: '12px' }}>
                          <span className="talent-score-value" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>0%</span> Fit
                        </div>
                      </div>

                      {/* Interactive Doughnut Summary Chart */}
                      {renderTalentDonut(talentResult)}

                      {/* 12 Skillset Gap Grid */}
                      <div className="gap-analyzer-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        {talentResult.skillset_gap
                          .filter(item => {
                            if (talentFilter === 'ready') return !item.gap;
                            if (talentFilter === 'gap') return item.gap;
                            return true;
                          })
                          .map((item, i) => (
                          <div key={i} className="gap-item" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.65rem' }}>
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
                            <div className="level-indicator-bar" style={{ marginTop: '0.5rem' }}>
                              <div 
                                className="level-indicator-fill-cand" 
                                data-width={item.candidate_level * 10}
                                style={{ width: '0%', background: item.gap ? 'var(--danger)' : 'var(--success)' }} 
                              />
                              <div 
                                className="level-indicator-fill-req" 
                                data-width={item.required_level * 10}
                                style={{ width: '0%' }} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                      <Award size={36} className="empty-state-icon" />
                      <p>Run Talent Check to see candidate readiness compared against standard company skill definitions.</p>
                    </div>
                  )}
                </section>

              </div>
            </div>
          )}

          {/* STEP 4: SKILL MATCHING */}
          {step === 4 && (
            <div className="step-container">
              <div className="step-header">
                <h2>4. Job Description Skill Matching</h2>
                <p>Run comparison mapping to check candidate matches directly against the structured requirements of the parsed JD.</p>
              </div>

              <div className="side-by-side-grid">
                
                {/* Match Trigger Section */}
                <section className="glass-panel" style={{ margin: 0, alignSelf: 'start' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                    <Briefcase size={16} style={{ color: 'var(--primary)' }} />
                    Relevance Matching Core
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Matches skills extracted from the uploaded resume against keywords parsed from the job description workspace.
                  </p>

                  <button 
                    onClick={handleSkillMatch} 
                    disabled={matchLoading}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}
                  >
                    {matchLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Run Skill Match Check
                  </button>
                </section>

                {/* Match Results Visualizer */}
                <section className="glass-panel" style={{ margin: 0 }}>
                  {matchResult ? (
                    <div>
                      <div className="skill-match-container" style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        {renderCircleMeter(matchResult.match_score)}
                        <div className="match-breakdown-details">
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            Target Source Job File:
                          </p>
                          <p style={{ fontSize: '0.85rem', fontWeight: 650, color: 'white', wordBreak: 'break-all' }}>
                            {matchResult.jd_source_file}
                          </p>
                        </div>
                      </div>
                      
                      <div 
                        onMouseEnter={() => setHoveredMatchSegment('matched')}
                        onMouseLeave={() => setHoveredMatchSegment('all')}
                        style={{ 
                          marginTop: '1.5rem', 
                          opacity: hoveredMatchSegment === 'missing' ? 0.35 : 1, 
                          transition: 'all 0.3s ease', 
                          cursor: 'pointer', 
                          padding: '0.5rem', 
                          borderRadius: '8px', 
                          background: hoveredMatchSegment === 'matched' ? 'rgba(255,255,255,0.01)' : 'transparent' 
                        }}
                      >
                        <h4 style={{ fontSize: '0.85rem', color: 'white', marginBottom: '0.5rem', fontWeight: 600 }}>Matched Skills ({matchResult.matched_skills.length})</h4>
                        <div className="skill-chips-list">
                          {matchResult.matched_skills.map((skill, i) => (
                            <span key={i} className="chip chip-matched">{skill}</span>
                          ))}
                          {matchResult.matched_skills.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No direct overlaps found</span>}
                        </div>
                      </div>

                      <div 
                        onMouseEnter={() => setHoveredMatchSegment('missing')}
                        onMouseLeave={() => setHoveredMatchSegment('all')}
                        style={{ 
                          marginTop: '1.25rem', 
                          opacity: hoveredMatchSegment === 'matched' ? 0.35 : 1, 
                          transition: 'all 0.3s ease', 
                          cursor: 'pointer', 
                          padding: '0.5rem', 
                          borderRadius: '8px', 
                          background: hoveredMatchSegment === 'missing' ? 'rgba(255,255,255,0.01)' : 'transparent' 
                        }}
                      >
                        <h4 style={{ fontSize: '0.85rem', color: 'white', marginBottom: '0.5rem', fontWeight: 600 }}>Missing / Gaps ({matchResult.missing_skills.length})</h4>
                        <div className="skill-chips-list">
                          {matchResult.missing_skills.map((skill, i) => (
                            <span key={i} className="chip chip-missing">{skill}</span>
                          ))}
                          {matchResult.missing_skills.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No gaps detected</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                      <Briefcase size={36} className="empty-state-icon" />
                      <p>Run the Skill Match analysis to visualize details and gap indices.</p>
                    </div>
                  )}
                </section>

              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY VIEW */}
          {step === 5 && (
            <div className="step-container">
              <div className="step-header">
                <h2>5. Consolidated Summary Flow</h2>
                <p>Overview of the entire pipeline, documents status, candidate credentials, and comparative scores.</p>
              </div>

              <div className="side-by-side-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
                
                {/* Candidate Overview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <section className="glass-panel" style={{ margin: 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'white' }}>Profile Summary Card</h3>
                    <div className="profile-summary-header" style={{ marginBottom: '1.25rem' }}>
                      <div className="profile-avatar">
                        {profile.name ? profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'C'}
                      </div>
                      <div className="profile-basics">
                        <h3>{profile.name || "No name parsed"}</h3>
                        <p style={{ fontSize: '0.8rem' }}><Mail size={12} /> {profile.email || "No email parsed"}</p>
                        {profile.education && <p style={{ fontSize: '0.8rem' }}><Briefcase size={12} /> {profile.education}</p>}
                      </div>
                    </div>

                    <div className="profile-stat-grid">
                      <div className="profile-stat-box">
                        <strong>{profile.skills?.length || 0}</strong>
                        Skills
                      </div>
                      <div className="profile-stat-box">
                        <strong>{profile.certifications?.length || 0}</strong>
                        Certs
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
                  </section>

                  {/* Documents & Workspace Summary */}
                  <section className="glass-panel" style={{ margin: 0 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'white' }}>Documents Status</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Job Description File:</span>
                        <strong style={{ fontSize: '0.85rem', color: jdParsedFile ? 'var(--primary)' : 'var(--text-muted)' }}>{jdParsedFile || 'Not Loaded'}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Resume File:</span>
                        <strong style={{ fontSize: '0.85rem', color: resumeParsedFile ? 'var(--primary)' : 'var(--text-muted)' }}>{resumeParsedFile || 'Not Loaded'}</strong>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Score Summary Fills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <section className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Job Match Index</h3>
                    {matchResult ? (
                      <div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--primary)' }}>
                          {matchResult.match_score}%
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Matches {matchResult.matched_skills.length} skills from {matchResult.jd_source_file}</p>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Match computed yet.</span>
                    )}
                  </section>

                  <section className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Company Readiness Score</h3>
                    {talentResult ? (
                      <div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--secondary)' }}>
                          {talentResult.readiness_score}%
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Ready for {talentResult.company} ({talentResult.role})</p>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No Talent Check run yet.</span>
                    )}
                  </section>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
