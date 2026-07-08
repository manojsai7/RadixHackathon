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
  Mail,
  Download,
  Terminal,
  Database,
  Sliders,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

const API_BASE = 'http://localhost:5000/api';

// Types
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

interface ApiLog {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  requestBody?: any;
  responseBody?: any;
  status: number;
  timestamp: string;
  durationMs: number;
}

function App() {
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Navigation state (1-5 representing the 5 roles)
  const [step, setStep] = useState(1);

  // Lists of samples loaded on startup
  const [sampleJds, setSampleJds] = useState<string[]>([]);
  const [sampleResumes, setSampleResumes] = useState<string[]>([]);
  
  // Selection
  const [selectedJdSample, setSelectedJdSample] = useState('');
  const [selectedResumeSample, setSelectedResumeSample] = useState('');
  
  // Custom uploaded files
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  
  // Ingestion loading states
  const [jdLoading, setJdLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [jdParsedFile, setJdParsedFile] = useState('');
  const [resumeParsedFile, setResumeParsedFile] = useState('');
  
  // JD details extracted
  const [parsedJdDetails, setParsedJdDetails] = useState<{ company: string; role: string; skills: Skill[] } | null>(null);

  // Profile State (Source of Truth)
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
  
  // Custom tag builders inside Profile Builder
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCat, setNewSkillCat] = useState('COD');
  const [newSkillLevel, setNewSkillLevel] = useState(5); // slider 1-10
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
  const [talentFilter, setTalentFilter] = useState<'all' | 'ready' | 'gap'>('all');
  const [hoveredMatchSegment, setHoveredMatchSegment] = useState<'all' | 'matched' | 'missing'>('all');

  // Developer Live API Console States (collapsed by default, expandable via status bar)
  const [apiConsoleOpen, setApiConsoleOpen] = useState(false);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  // Company - Role Mapping
  const companyRoles: Record<string, string[]> = {
    "Google": ["Software Engineer", "Data Scientist"],
    "Microsoft": ["Software Engineer", "Data Analyst"],
    "Oracle Financial Services Software": ["Associate Software Engineer", "Application Support Analyst"]
  };

  // Helper to log HTTP requests and responses in Live Dev Console
  const logApiCall = async (method: 'GET' | 'POST', path: string, body: any, apiCallPromise: Promise<any>) => {
    const start = Date.now();
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    const newLog: ApiLog = {
      id,
      method,
      path,
      requestBody: body,
      status: 0,
      timestamp,
      durationMs: 0
    };
    
    setApiLogs(prev => [newLog, ...prev]);
    try {
      const res = await apiCallPromise;
      const duration = Date.now() - start;
      setApiLogs(prev => prev.map(log => log.id === id ? { ...log, status: res.status, responseBody: res.data, durationMs: duration } : log));
      setSelectedLog({ ...newLog, status: res.status, responseBody: res.data, durationMs: duration });
      return res;
    } catch (err: any) {
      const duration = Date.now() - start;
      const errStatus = err.response?.status || 500;
      const errData = err.response?.data || { error: err.message };
      setApiLogs(prev => prev.map(log => log.id === id ? { ...log, status: errStatus, responseBody: errData, durationMs: duration } : log));
      setSelectedLog({ ...newLog, status: errStatus, responseBody: errData, durationMs: duration });
      throw err;
    }
  };

  useEffect(() => {
    fetchSamples();
    fetchProfile();
  }, []);

  // GSAP entrance animation on load
  useGSAP(() => {
    gsap.from(".glass-panel", {
      opacity: 0,
      y: 35,
      duration: 0.7,
      stagger: 0.08,
      ease: "power3.out"
    });
  }, { scope: mainRef });

  // GSAP animation on step change
  useGSAP(() => {
    if (contentRef.current) {
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [step]);

  // GSAP animation for Talent Check bars
  useGSAP(() => {
    if (talentResult) {
      gsap.set(".level-indicator-fill-cand", { width: "0%" });
      gsap.set(".level-indicator-fill-req", { width: "0%" });

      gsap.to(".level-indicator-fill-cand", {
        width: (_, target) => target.getAttribute('data-width') + "%",
        duration: 1.0,
        ease: "power3.out",
        stagger: 0.02
      });

      gsap.to(".level-indicator-fill-req", {
        width: (_, target) => target.getAttribute('data-width') + "%",
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.01
      });

      const scoreValueEl = document.querySelector(".talent-score-value");
      if (scoreValueEl) {
        const valObj = { val: 0 };
        gsap.to(valObj, {
          val: talentResult.readiness_score,
          duration: 1.2,
          snap: { val: 1 },
          ease: "power2.out",
          onUpdate: () => {
            scoreValueEl.textContent = valObj.val + "%";
          }
        });
      }
    }
  }, [talentResult]);

  // GSAP animation for Skill Match ring & chips
  useGSAP(() => {
    if (matchResult) {
      const ring = document.querySelector(".value-ring") as SVGPathElement | null;
      if (ring) {
        const circumference = parseFloat(ring.getAttribute("data-circumference") || "0");
        const targetOffset = parseFloat(ring.getAttribute("data-offset") || "0");
        
        gsap.set(ring, { strokeDashoffset: circumference });
        
        gsap.to(ring, {
          strokeDashoffset: targetOffset,
          duration: 1.3,
          ease: "power3.out"
        });
      }

      const matchScoreEl = document.querySelector(".match-score-number");
      if (matchScoreEl) {
        const matchObj = { val: 0 };
        gsap.to(matchObj, {
          val: matchResult.match_score,
          duration: 1.3,
          snap: { val: 1 },
          ease: "power2.out",
          onUpdate: () => {
            matchScoreEl.textContent = matchObj.val + "%";
          }
        });
      }

      gsap.from(".chip-matched", {
        opacity: 0,
        x: -12,
        duration: 0.4,
        stagger: 0.02,
        ease: "power1.out"
      });

      gsap.from(".chip-missing", {
        opacity: 0,
        x: 12,
        duration: 0.4,
        stagger: 0.02,
        ease: "power1.out"
      });
    }
  }, [matchResult]);

  // Fetch samples list
  const fetchSamples = async () => {
    try {
      const res = await logApiCall('GET', '/get_samples', null, axios.get(`${API_BASE}/get_samples`));
      setSampleJds(res.data.jds || []);
      setSampleResumes(res.data.resumes || []);
      if (res.data.jds?.length > 0) setSelectedJdSample(res.data.jds[0]);
      if (res.data.resumes?.length > 0) setSelectedResumeSample(res.data.resumes[0]);
    } catch (err) {
      triggerAlert('Failed to load sample files list', 'error');
    }
  };

  // Fetch candidate profile from saved session
  const fetchProfile = async () => {
    try {
      const res = await logApiCall('GET', '/get_profile', null, axios.get(`${API_BASE}/get_profile`));
      if (res.data) {
        setProfile({
          ...res.data,
          skills: res.data.skills || [],
          hackathons: res.data.hackathons || [],
          internships: res.data.internships || [],
          certifications: res.data.certifications || [],
          preferred_roles: res.data.preferred_roles || []
        });
        if (res.data.cv_file) {
          setResumeParsedFile(res.data.cv_file);
        }
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

  // Ingest & Parse JD (Role 1)
  const handleParseJD = async () => {
    setJdLoading(true);
    triggerAlert('Ingesting Job Description...', 'info');
    try {
      let res;
      if (jdFile) {
        const formData = new FormData();
        formData.append('file', jdFile);
        res = await logApiCall('POST', '/parse_jd (File Upload)', { filename: jdFile.name }, axios.post(`${API_BASE}/parse_jd`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }));
      } else if (selectedJdSample) {
        res = await logApiCall('POST', '/parse_jd (Sample Select)', { sample_name: selectedJdSample }, axios.post(`${API_BASE}/parse_jd`, { sample_name: selectedJdSample }));
      } else {
        triggerAlert('Please upload a file or select a sample JD', 'error');
        setJdLoading(false);
        return;
      }
      
      setParsedJdDetails(res.data);
      setJdParsedFile(res.data.source_file);
      triggerAlert(`JD parsed! Found ${res.data.skills?.length || 0} skills.`, 'success');
      
      // Auto-set matching company/role if available
      if (res.data.company && res.data.company !== 'Unknown' && companyRoles[res.data.company]) {
        setSelectedCompany(res.data.company);
        if (res.data.role && res.data.role !== 'Unknown') {
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

  // Ingest & Parse Resume (Role 2)
  const handleParseResume = async () => {
    setResumeLoading(true);
    triggerAlert('Extracting skills from Resume...', 'info');
    try {
      let res;
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        res = await logApiCall('POST', '/parse_resume (File Upload)', { filename: resumeFile.name }, axios.post(`${API_BASE}/parse_resume`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }));
      } else if (selectedResumeSample) {
        res = await logApiCall('POST', '/parse_resume (Sample Select)', { sample_name: selectedResumeSample }, axios.post(`${API_BASE}/parse_resume`, { sample_name: selectedResumeSample }));
      } else {
        triggerAlert('Please upload a file or select a sample Resume', 'error');
        setResumeLoading(false);
        return;
      }
      
      setResumeParsedFile(res.data.source_file || 'Sample Resume');
      triggerAlert('Resume parsed. Candidate details pre-filled!', 'success');
      
      // Refresh local profile state from backend
      await fetchProfile();
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Error parsing Resume', 'error');
    } finally {
      setResumeLoading(false);
    }
  };

  // Save Candidate Profile (Role 3)
  const handleSaveProfile = async () => {
    try {
      const res = await logApiCall('POST', '/save_profile', profile, axios.post(`${API_BASE}/save_profile`, profile));
      if (res.data?.profile) {
        setProfile({
          ...res.data.profile,
          skills: res.data.profile.skills || [],
          hackathons: res.data.profile.hackathons || [],
          internships: res.data.profile.internships || [],
          certifications: res.data.profile.certifications || [],
          preferred_roles: res.data.profile.preferred_roles || []
        });
      }
      triggerAlert('Candidate profile saved successfully!', 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Failed to save profile', 'error');
    }
  };

  // Run Company Talent Check (Role 4)
  const handleTalentCheck = async () => {
    setTalentLoading(true);
    triggerAlert(`Benchmarking against ${selectedCompany}...`, 'info');
    try {
      const res = await logApiCall('GET', `/talent_check?company=${selectedCompany}&role=${selectedRole}`, null, axios.get(`${API_BASE}/talent_check`, {
        params: { company: selectedCompany, role: selectedRole }
      }));
      setTalentResult(res.data);
      triggerAlert(`Talent Check complete! score: ${res.data.readiness_score}%`, 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Talent Check failed. Please build a profile first.', 'error');
    } finally {
      setTalentLoading(false);
    }
  };

  // Run Skill Match checking (Role 5)
  const handleSkillMatch = async () => {
    setMatchLoading(true);
    triggerAlert('Matching candidate skills against JD...', 'info');
    try {
      const res = await logApiCall('GET', '/skill_match', null, axios.get(`${API_BASE}/skill_match`));
      setMatchResult(res.data);
      triggerAlert(`Skill Match complete! score: ${res.data.match_score}%`, 'success');
    } catch (err: any) {
      triggerAlert(err.response?.data?.error || 'Skill Match failed. Ensure you parsed a JD and saved a profile first.', 'error');
    } finally {
      setMatchLoading(false);
    }
  };

  // Reset Session
  const handleResetSession = async () => {
    if (window.confirm("Are you sure you want to clear the session? This resets all parsed files.")) {
      try {
        await logApiCall('POST', '/reset_session', null, axios.post(`${API_BASE}/reset_session`));
        setJdFile(null);
        setResumeFile(null);
        setJdParsedFile('');
        setResumeParsedFile('');
        setParsedJdDetails(null);
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

  // Profile Builder edits
  const addSkill = () => {
    if (!newSkillName.trim()) return;
    const isDuplicate = (profile.skills || []).some(
      s => s.skill_name.toLowerCase() === newSkillName.trim().toLowerCase()
    );
    if (isDuplicate) {
      triggerAlert('Skill already exists in profile', 'error');
      return;
    }
    
    // Map raw level slider (1-10) to confidence model limits
    const confidence = newSkillLevel >= 8 ? 'high' : (newSkillLevel >= 4 ? 'medium' : 'low');
    
    const newSkill: Skill = {
      skill_name: newSkillName.trim(),
      category_code: newSkillCat,
      evidence: 'Manually added by candidate',
      confidence
    };
    setProfile({
      ...profile,
      skills: [...(profile.skills || []), newSkill]
    });
    setNewSkillName('');
    setNewSkillLevel(5);
  };

  const removeSkill = (index: number) => {
    const updated = [...(profile.skills || [])];
    updated.splice(index, 1);
    setProfile({ ...profile, skills: updated });
  };

  const updateSkillConfidence = (index: number, confidence: 'high' | 'medium' | 'low') => {
    const updated = [...(profile.skills || [])];
    updated[index].confidence = confidence;
    setProfile({ ...profile, skills: updated });
  };

  const addTag = (field: 'hackathons' | 'internships' | 'certifications' | 'preferred_roles', value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const list = profile[field] || [];
    if (list.includes(value.trim())) return;
    setProfile({
      ...profile,
      [field]: [...list, value.trim()]
    });
    setter('');
  };

  const removeTag = (field: 'hackathons' | 'internships' | 'certifications' | 'preferred_roles', index: number) => {
    const list = profile[field] || [];
    const updated = [...list];
    updated.splice(index, 1);
    setProfile({ ...profile, [field]: updated });
  };

  // Profile completeness calculator
  const getProfileCompleteness = () => {
    let score = 0;
    if (profile.name) score += 15;
    if (profile.email) score += 15;
    if (profile.education) score += 15;
    if (profile.skills && profile.skills.length > 0) score += 25;
    if (profile.certifications && profile.certifications.length > 0) score += 10;
    if (profile.internships && profile.internships.length > 0) score += 10;
    if (profile.hackathons && profile.hackathons.length > 0) score += 10;
    return score;
  };
  
  const completeness = getProfileCompleteness();

  // Live calculated levels preview
  const candidateCalculatedLevels = () => {
    const categories = ["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS"];
    const levels: Record<string, number> = {};
    categories.forEach(cat => { levels[cat] = 1; });
    
    const skillsPoints: Record<string, number> = {};
    categories.forEach(cat => { skillsPoints[cat] = 0; });
    
    (profile.skills || []).forEach(skill => {
      const cat = skill.category_code;
      if (skillsPoints[cat] !== undefined) {
        const conf = skill.confidence || "medium";
        const weight = conf === "high" ? 3 : (conf === "medium" ? 2 : 1);
        skillsPoints[cat] += weight;
      }
    });
    
    categories.forEach(cat => {
      const points = skillsPoints[cat];
      if (points > 0) {
        levels[cat] = Math.min(10, 1 + points);
      }
    });
    
    const internships = profile.internships || [];
    const hackathons = profile.hackathons || [];
    const certifications = profile.certifications || [];
    
    if (internships.length > 0) {
      levels["SWE"] = Math.min(10, levels["SWE"] + Math.min(2, internships.length));
      levels["COMM"] = Math.min(10, levels["COMM"] + Math.min(2, internships.length));
    }
    
    if (hackathons.length > 0) {
      levels["COD"] = Math.min(10, levels["COD"] + Math.min(2, hackathons.length));
      levels["APTI"] = Math.min(10, levels["APTI"] + Math.min(1, hackathons.length));
      levels["DSA"] = Math.min(10, levels["DSA"] + Math.min(1, hackathons.length));
    }
    
    certifications.forEach(cert => {
      const certLower = cert.toLowerCase();
      if (certLower.includes("cloud") || certLower.includes("aws") || certLower.includes("azure") || certLower.includes("gcp")) {
        levels["CLOUD"] = Math.min(10, levels["CLOUD"] + 2);
      }
      if (certLower.includes("security") || certLower.includes("network") || certLower.includes("ccna")) {
        levels["NETW"] = Math.min(10, levels["NETW"] + 2);
      }
      if (certLower.includes("database") || certLower.includes("sql") || certLower.includes("oracle")) {
        levels["SQL"] = Math.min(10, levels["SQL"] + 2);
      }
      if (certLower.includes("machine learning") || certLower.includes("ai") || certLower.includes("deep learning")) {
        levels["AI"] = Math.min(10, levels["AI"] + 2);
      }
    });
    
    return levels;
  };

  const calculatedLevels = candidateCalculatedLevels();

  const getSkillDistribution = () => {
    const counts: Record<string, number> = {};
    const list = profile.skills || [];
    list.forEach(s => {
      counts[s.category_code] = (counts[s.category_code] || 0) + 1;
    });
    return counts;
  };

  const handlePrint = () => {
    window.print();
  };

  // Render SVG Completeness Ring (Step 3)
  const renderCompletenessRing = (score: number) => {
    const size = 90;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
          <circle 
            cx={size / 2} 
            cy={size / 2} 
            r={radius} 
            fill="transparent" 
            stroke="var(--gold)" 
            strokeWidth={strokeWidth} 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--gold)', fontFamily: 'Outfit' }}>{score}%</span>
          <span style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Complete</span>
        </div>
      </div>
    );
  };

  // Render SVG Skill Match Ring (Step 5)
  const renderSkillMatchRing = (score: number) => {
    const size = 110;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth={strokeWidth} />
          <circle 
            className="value-ring"
            cx={size / 2} 
            cy={size / 2} 
            r={radius} 
            fill="transparent" 
            stroke="var(--gold)" 
            strokeWidth={strokeWidth} 
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            data-offset={offset}
            data-circumference={circumference}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="match-score-number" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--gold)', fontFamily: 'Outfit' }}>0%</span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Overlap</span>
        </div>
      </div>
    );
  };

  // Render SVG Talent Doughnut Chart (Step 4)
  const renderTalentDonut = (result: TalentCheckResult) => {
    const total = result.skillset_gap.length;
    const gaps = result.skillset_gap.filter(item => item.gap).length;
    const ready = total - gaps;
    const radius = 30;
    const circ = 2 * Math.PI * radius;
    const readyStrokeOffset = circ - (ready / total) * circ;
    const gapStrokeOffset = circ - (gaps / total) * circ;
    
    return (
      <div className="talent-donut-chart-container">
        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Skill Category Breakdown</h4>
        
        <div style={{ position: 'relative', width: '90px', height: '90px' }}>
          <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="45" cy="45" r={radius} fill="transparent" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="6" />
            <circle 
              cx="45" 
              cy="45" 
              r={radius} 
              fill="transparent" 
              stroke="var(--emerald)" 
              strokeWidth="6" 
              strokeDasharray={circ} 
              strokeDashoffset={readyStrokeOffset} 
              strokeLinecap="round"
            />
            <circle 
              cx="45" 
              cy="45" 
              r={radius} 
              fill="transparent" 
              stroke="var(--rose)" 
              strokeWidth="6" 
              strokeDasharray={circ} 
              strokeDashoffset={gapStrokeOffset} 
              strokeLinecap="round"
              style={{ 
                transform: `rotate(${(ready / total) * 360}deg)`,
                transformOrigin: '45px 45px'
              }}
            />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{ready}/{total}</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Ready</span>
          </div>
        </div>
        
        {/* Legends & Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', width: '100%', justifyContent: 'center' }}>
          <button 
            onClick={() => setTalentFilter('all')} 
            className={`btn btn-secondary ${talentFilter === 'all' ? 'active' : ''}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px solid var(--glass-border)', width: 'auto' }}
          >
            All ({total})
          </button>
          
          <button 
            onClick={() => setTalentFilter('ready')} 
            className={`btn btn-secondary ${talentFilter === 'ready' ? 'active' : ''}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px solid var(--glass-border)', color: 'var(--emerald)', width: 'auto' }}
          >
            Ready ({ready})
          </button>
          
          <button 
            onClick={() => setTalentFilter('gap')} 
            className={`btn btn-secondary ${talentFilter === 'gap' ? 'active' : ''}`}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px solid var(--glass-border)', color: 'var(--rose)', width: 'auto' }}
          >
            Gaps ({gaps})
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout" ref={mainRef}>
      
      {/* 1. LEFT SIDEBAR (Icon-only, hover expanding) */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Zap size={18} style={{ color: 'var(--gold)' }} />
            <h1>RADIX Talent</h1>
          </div>
          
          <nav className="sidebar-nav">
            <button 
              className={`sidebar-btn ${step === 1 ? 'active' : ''}`}
              onClick={() => setStep(1)}
              title="JD Analytics"
            >
              <Briefcase size={16} />
              <span>1. JD Analytics</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 2 ? 'active' : ''}`}
              onClick={() => setStep(2)}
              title="Resume Parsing"
            >
              <FileText size={16} />
              <span>2. Resume Parsing</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 3 ? 'active' : ''}`}
              onClick={() => setStep(3)}
              title="Profile Builder"
            >
              <User size={16} />
              <span>3. Profile Builder</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 4 ? 'active' : ''}`}
              onClick={() => setStep(4)}
              title="Talent Check"
            >
              <Award size={16} />
              <span>4. Talent Check</span>
            </button>
            <button 
              className={`sidebar-btn ${step === 5 ? 'active' : ''}`}
              onClick={() => setStep(5)}
              title="Skill Matching"
            >
              <Sliders size={16} />
              <span>5. Skill Matching</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator-box">
            <div className={`status-dot-line ${jdParsedFile ? 'active' : ''}`}>
              <div className={`status-dot-light ${jdParsedFile ? 'active' : ''}`} />
              <span>JD Active</span>
            </div>
            <div className={`status-dot-line ${resumeParsedFile ? 'active' : ''}`}>
              <div className={`status-dot-light ${resumeParsedFile ? 'active' : ''}`} />
              <span>Resume Active</span>
            </div>
          </div>
          
          <button 
            onClick={handleResetSession} 
            className="btn btn-secondary btn-danger" 
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.45rem' }}
          >
            <RefreshCw size={12} /> Reset Cache
          </button>
        </div>
      </aside>

      {/* 2. CENTER MAIN WORKSPACE */}
      <main className="main-workspace">
        
        {/* Banner Alert notifications */}
        {alertMsg.text && (
          <div className={`status-text-panel ${alertMsg.type === 'success' ? 'status-success' : 'status-info'}`} style={{ margin: 0 }}>
            <AlertCircle size={14} />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <div className="step-container" ref={contentRef}>
          
          {/* STEP 1: JD ANALYTICS */}
          {step === 1 && (
            <div className="step-container">
              <div className="step-header">
                <h2>1. Job Description Analytics</h2>
                <p>Ingest raw corporate job descriptions and extract standardized RADIX capability indicators.</p>
              </div>
              <div className="side-by-side-grid">
                <section className="glass-panel">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Briefcase size={14} style={{ color: 'var(--gold)' }} />
                    Job Description Configuration
                  </h3>
                  
                  <div className="form-group">
                    <label>Select Sample Corporate JD</label>
                    <select 
                      value={selectedJdSample || ''} 
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
                    <label className="upload-label">Or upload custom text description (TXT/PDF/DOCX)</label>
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
                      <Briefcase size={20} className="dropzone-icon" />
                      {jdFile ? (
                        <p className="dropzone-filename"><Check size={12} /> {jdFile.name}</p>
                      ) : (
                        <p style={{ fontSize: '0.75rem' }}>Drag & drop custom Job Description</p>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleParseJD} 
                    disabled={jdLoading}
                    className="btn btn-primary"
                  >
                    {jdLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Ingest & Parse JD
                  </button>
                </section>

                <section className="glass-panel">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Database size={14} style={{ color: 'var(--copper)' }} />
                    Extracted Capabilities Preview
                  </h3>
                  
                  {jdLoading ? (
                    <div className="scanner-viewport">
                      <div className="scanner-doc-silhouette">
                        <div className="scanner-laser-line"></div>
                        <div className="scanner-doc-line"></div>
                        <div className="scanner-doc-line short"></div>
                        <div className="scanner-doc-line medium"></div>
                        <div className="scanner-doc-line"></div>
                      </div>
                      <div className="scanner-status-text">Scanning Job Description...</div>
                    </div>
                  ) : parsedJdDetails ? (
                    <div>
                      <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Target Role parsed</p>
                        <h4 style={{ fontSize: '1rem', color: 'white' }}>{parsedJdDetails.role}</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Company: {parsedJdDetails.company}</p>
                      </div>
                      
                      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        <label className="upload-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Extracted Skills ({parsedJdDetails.skills?.length})</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {parsedJdDetails.skills?.map((skill, idx) => (
                            <span key={idx} className={`badge badge-${skill.category_code}`}>
                              {skill.skill_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Briefcase size={28} className="empty-state-icon" style={{ color: 'var(--gold)' }} />
                      <p>No JD parsed yet. Select a sample or upload above to extract skills.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* STEP 2: RESUME PARSING */}
          {step === 2 && (
            <div className="step-container">
              <div className="step-header">
                <h2>2. Resume Ingestion & Parsing</h2>
                <p>Extract candidate context, email coordinates, educational benchmarks, and skill sets from CV documents.</p>
              </div>
              <div className="side-by-side-grid">
                <section className="glass-panel">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={14} style={{ color: 'var(--gold)' }} />
                    Upload Candidate Resume
                  </h3>
                  
                  <div className="form-group">
                    <label>Select Sample Candidate Resume</label>
                    <select 
                      value={selectedResumeSample || ''} 
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
                    <label className="upload-label">Or upload custom CV (TXT/PDF/DOCX)</label>
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
                      <FileText size={20} className="dropzone-icon" />
                      {resumeFile ? (
                        <p className="dropzone-filename"><Check size={12} /> {resumeFile.name}</p>
                      ) : (
                        <p style={{ fontSize: '0.75rem' }}>Drag & drop custom Resume</p>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleParseResume} 
                    disabled={resumeLoading}
                    className="btn btn-primary"
                  >
                    {resumeLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Ingest & Parse Resume
                  </button>
                </section>

                <section className="glass-panel">
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={14} style={{ color: 'var(--copper)' }} />
                    Extracted Details Preview
                  </h3>
                  
                  {resumeLoading ? (
                    <div className="scanner-viewport">
                      <div className="scanner-doc-silhouette">
                        <div className="scanner-laser-line"></div>
                        <div className="scanner-doc-line"></div>
                        <div className="scanner-doc-line short"></div>
                        <div className="scanner-doc-line medium"></div>
                        <div className="scanner-doc-line"></div>
                      </div>
                      <div className="scanner-status-text">Scanning Resume File...</div>
                    </div>
                  ) : resumeParsedFile ? (
                    <div>
                      <div className="profile-summary-header" style={{ marginBottom: '0.75rem' }}>
                        <div className="profile-avatar">
                          {profile.name ? profile.name.substring(0,2).toUpperCase() : 'C'}
                        </div>
                        <div className="profile-basics">
                          <h3>{profile.name || "Extracting..."}</h3>
                          <p style={{ fontSize: '0.7rem' }}><Mail size={10} /> {profile.email || "No email parsed"}</p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        <p><strong>Education:</strong> {profile.education || "Not specified"}</p>
                        <p><strong>Source CV File:</strong> {profile.cv_file || "Sample Resume"}</p>
                      </div>

                      {/* Distribution chart */}
                      <div className="stats-chart-card" style={{ marginBottom: '0.75rem' }}>
                        <div className="stats-chart-title">Capability distribution weights</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                          {Object.keys(getSkillDistribution()).length > 0 ? (
                            Object.keys(getSkillDistribution()).map(cat => {
                              const count = getSkillDistribution()[cat];
                              const total = (profile.skills || []).length;
                              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                              return (
                                <div className="chart-bar-row" key={cat}>
                                  <div className="chart-bar-meta">
                                    <span className="chart-bar-name">
                                      <span className={`badge badge-${cat}`}>{cat}</span>
                                    </span>
                                    <span className="chart-bar-value">{count} skill{count > 1 ? 's' : ''} ({pct}%)</span>
                                  </div>
                                  <div className="chart-bar-container">
                                    <div className="chart-bar-fill" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No skills to analyze.</p>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        <label className="upload-label" style={{ marginBottom: '0.35rem', display: 'block' }}>Parsed Skills ({ (profile.skills || []).length })</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {(profile.skills || []).map((skill, idx) => (
                            <span key={idx} className={`badge badge-${skill.category_code}`}>
                              {skill.skill_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <FileText size={28} className="empty-state-icon" style={{ color: 'var(--gold)' }} />
                      <p>No Resume parsed yet. Select a sample or upload above to extract details.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* STEP 3: PROFILE BUILDER */}
          {step === 3 && (
            <div className="step-container">
              <div className="step-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>3. Candidate Profile Builder</h2>
                    <p>Enrich candidate parameters, log hackathons, internships, credentials and custom capabilities.</p>
                  </div>
                  <button 
                    onClick={handlePrint}
                    className="btn btn-secondary" 
                    style={{ width: 'auto', display: 'inline-flex', gap: '0.35rem', padding: '0.5rem 0.75rem' }}
                  >
                    <Download size={14} /> Download PDF Profile
                  </button>
                </div>
              </div>
              
              <div className="side-by-side-grid">
                
                {/* Form fields */}
                <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                    <User size={14} style={{ color: 'var(--gold)' }} />
                    Personal & Candidate Context
                  </h3>
                  
                  <div className="form-group">
                    <label>Candidate Full Name</label>
                    <input 
                      type="text" 
                      value={profile.name || ''} 
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })} 
                      className="text-input"
                      placeholder="Jane Doe"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        value={profile.email || ''} 
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })} 
                        className="text-input"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Education</label>
                      <input 
                        type="text" 
                        value={profile.education || ''} 
                        onChange={(e) => setProfile({ ...profile, education: e.target.value })} 
                        className="text-input"
                        placeholder="M.S. in Computer Science"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Preferred Roles</label>
                    <div className="tag-container" style={{ marginBottom: '0.35rem' }}>
                      {(profile.preferred_roles || []).map((tag, i) => (
                        <span key={i} className="profile-tag">
                          {tag}
                          <button onClick={() => removeTag('preferred_roles', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {(profile.preferred_roles || []).length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>No roles added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newPrefRole || ''} 
                        onChange={(e) => setNewPrefRole(e.target.value)} 
                        className="text-input" 
                        placeholder="Add role & press Plus"
                        style={{ padding: '0.35rem 0.5rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('preferred_roles', newPrefRole, setNewPrefRole)}
                      />
                      <button onClick={() => addTag('preferred_roles', newPrefRole, setNewPrefRole)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem' }}><Plus size={12} /></button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Internships</label>
                    <div className="tag-container" style={{ marginBottom: '0.35rem' }}>
                      {(profile.internships || []).map((tag, i) => (
                        <span key={i} className="profile-tag">
                          {tag}
                          <button onClick={() => removeTag('internships', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {(profile.internships || []).length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>No internships added</span>}
                    </div>
                    <div className="tag-input-wrapper">
                      <input 
                        type="text" 
                        value={newInternship || ''} 
                        onChange={(e) => setNewInternship(e.target.value)} 
                        className="text-input" 
                        placeholder="Google Software Intern"
                        style={{ padding: '0.35rem 0.5rem' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag('internships', newInternship, setNewInternship)}
                      />
                      <button onClick={() => addTag('internships', newInternship, setNewInternship)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem' }}><Plus size={12} /></button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Hackathons & Certifications</label>
                    <div className="tag-container" style={{ marginBottom: '0.35rem' }}>
                      {(profile.hackathons || []).map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(185, 116, 85, 0.25)', color: '#ffccbc' }}>
                          {tag}
                          <button onClick={() => removeTag('hackathons', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {(profile.certifications || []).map((tag, i) => (
                        <span key={i} className="profile-tag" style={{ borderColor: 'rgba(224, 169, 109, 0.25)', color: '#eedca2' }}>
                          {tag}
                          <button onClick={() => removeTag('certifications', i)}><X size={10} /></button>
                        </span>
                      ))}
                      {((profile.hackathons || []).length === 0 && (profile.certifications || []).length === 0) && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>No hackathons or certifications added</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <div className="tag-input-wrapper" style={{ flex: 1 }}>
                        <input 
                          type="text" 
                          value={newHackathon || ''} 
                          onChange={(e) => setNewHackathon(e.target.value)} 
                          className="text-input" 
                          placeholder="Hackathon details"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          onKeyDown={(e) => e.key === 'Enter' && addTag('hackathons', newHackathon, setNewHackathon)}
                        />
                        <button onClick={() => addTag('hackathons', newHackathon, setNewHackathon)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem' }}><Plus size={12} /></button>
                      </div>
                      <div className="tag-input-wrapper" style={{ flex: 1 }}>
                        <input 
                          type="text" 
                          value={newCert || ''} 
                          onChange={(e) => setNewCert(e.target.value)} 
                          className="text-input" 
                          placeholder="AWS Solutions Arch"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          onKeyDown={(e) => e.key === 'Enter' && addTag('certifications', newCert, setNewCert)}
                        />
                        <button onClick={() => addTag('certifications', newCert, setNewCert)} className="btn btn-secondary" style={{ width: 'auto', padding: '0.4rem' }}><Plus size={12} /></button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveProfile} 
                    className="btn btn-primary"
                  >
                    <CheckSquare size={14} /> Save Profile & Update Cache
                  </button>
                </section>

                {/* Skills editor & Live calculated skillsets preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Stats Count cards & Completeness gauge */}
                  <section className="glass-panel">
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <Award size={14} style={{ color: 'var(--gold)' }} />
                      Profile Stats & Completeness
                    </h3>
                    
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      {renderCompletenessRing(completeness)}
                      <div className="stat-widget-grid">
                        <div className="stat-widget-box">
                          <span className="stat-widget-num">{ (profile.skills || []).length }</span>
                          <span className="stat-widget-lbl">Skills</span>
                        </div>
                        <div className="stat-widget-box">
                          <span className="stat-widget-num">{ (profile.certifications || []).length }</span>
                          <span className="stat-widget-lbl">Certs</span>
                        </div>
                        <div className="stat-widget-box">
                          <span className="stat-widget-num">{ (profile.internships || []).length }</span>
                          <span className="stat-widget-lbl">Internships</span>
                        </div>
                        <div className="stat-widget-box">
                          <span className="stat-widget-num">{ (profile.hackathons || []).length }</span>
                          <span className="stat-widget-lbl">Hackathons</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-panel">
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem' }}>
                      <Code size={14} style={{ color: 'var(--copper)' }} />
                      Manage Skills ({ (profile.skills || []).length })
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '0.35rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={newSkillName || ''}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        className="text-input"
                        placeholder="Skill (e.g. C++)"
                        onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                        style={{ padding: '0.35rem' }}
                      />
                      <select 
                        value={newSkillCat || ''} 
                        onChange={(e) => setNewSkillCat(e.target.value)} 
                        className="select-input"
                        style={{ padding: '0.35rem' }}
                      >
                        {["COD", "DSA", "OOD", "APTI", "COMM", "AI", "CLOUD", "SQL", "SWE", "SYSD", "NETW", "OS", "OTHER"].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Lvl: {newSkillLevel}</span>
                        <input 
                          type="range"
                          min="1"
                          max="10"
                          value={newSkillLevel}
                          onChange={(e) => setNewSkillLevel(parseInt(e.target.value))}
                          style={{ accentColor: 'var(--gold)', width: '100%', height: '4px', cursor: 'pointer' }}
                        />
                      </div>
                      <button onClick={addSkill} className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.5rem' }}><Plus size={12} /></button>
                    </div>

                    <div className="skills-list-editor" style={{ maxHeight: '120px' }}>
                      {(profile.skills || []).map((skill, idx) => (
                        <div key={idx} className="skill-edit-item">
                          <div className="skill-info-block">
                            <span className="skill-info-name">{skill.skill_name}</span>
                            <span className={`badge badge-${skill.category_code}`} style={{ marginTop: '0.15rem' }}>{skill.category_code}</span>
                          </div>
                          <div className="skill-meta-block">
                            <select 
                              value={skill.confidence || ''} 
                              onChange={(e) => updateSkillConfidence(idx, e.target.value as any)}
                              className="skill-confidence-select"
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                            <button onClick={() => removeSkill(idx)} className="skill-delete-btn"><Trash2 size={11} /></button>
                          </div>
                        </div>
                      ))}
                      {(!profile.skills || profile.skills.length === 0) && (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '1rem 0' }}>No skills added. Parse a resume to pre-fill.</p>
                      )}
                    </div>
                  </section>

                  {/* LIVE ESTIMATION MATRIX */}
                  <section className="glass-panel">
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sliders size={14} style={{ color: 'var(--gold)' }} />
                      Live Skill Matrix Preview (Calculated 1-10)
                    </h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Dynamic calculation based on skills confidence and portfolio metadata.
                    </p>
                    
                    <div className="skill-matrix-grid">
                      {Object.keys(calculatedLevels).map((cat) => (
                        <div className="matrix-cell" key={cat}>
                          <div className="matrix-cell-score">{calculatedLevels[cat]}</div>
                          <div className="matrix-cell-label">{cat}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

              </div>
            </div>
          )}

          {/* STEP 4: TALENT CHECK */}
          {step === 4 && (
            <div className="step-container">
              <div className="step-header">
                <h2>4. Company Talent Check Benchmarking</h2>
                <p>Benchmark the candidate profile parameters against specific target corporate bars to locate capability gaps.</p>
              </div>

              <div className="side-by-side-grid">
                <section className="glass-panel" style={{ alignSelf: 'start' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Award size={14} style={{ color: 'var(--gold)' }} />
                    Select Targets
                  </h3>
                  
                  <div className="form-group">
                    <label>Target Corporate Entity</label>
                    <select 
                      value={selectedCompany || ''} 
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
                    <label>Target Role Position</label>
                    <select 
                      value={selectedRole || ''} 
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
                    style={{ marginTop: '0.5rem' }}
                  >
                    {talentLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Compare Readiness Bar
                  </button>
                </section>

                <section className="glass-panel">
                  {talentResult ? (
                    <div>
                      <div className="talent-check-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', color: 'white' }}>{talentResult.company}</h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target: {talentResult.role}</p>
                        </div>
                        <div className="talent-score-badge">
                          <span className="talent-score-value" style={{ textShadow: '0 0 8px var(--gold)' }}>0%</span> readiness
                        </div>
                      </div>

                      {renderTalentDonut(talentResult)}

                      <div className="gap-analyzer-list" style={{ maxHeight: '240px' }}>
                        {talentResult.skillset_gap
                          .filter(item => {
                            if (talentFilter === 'ready') return !item.gap;
                            if (talentFilter === 'gap') return item.gap;
                            return true;
                          })
                          .map((item, i) => (
                            <div key={i} className="gap-item">
                              <div className="gap-item-title">
                                <span className={`badge badge-${item.category_code}`}>{item.category_code}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                    Cand: {item.candidate_level} / Bar: {item.required_level}
                                  </span>
                                  <span className="gap-status-tag">
                                    {item.gap ? (
                                      <span className="status-cross" style={{ color: 'var(--rose)' }}><XCircle size={12} /> GAP</span>
                                    ) : (
                                      <span className="status-check" style={{ color: 'var(--emerald)' }}><CheckCircle2 size={12} /> READY</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="level-indicator-bar">
                                <div 
                                  className="level-indicator-fill-cand" 
                                  data-width={item.candidate_level * 10}
                                  style={{ width: '0%', background: item.gap ? 'var(--rose)' : 'var(--gold-gradient)' }} 
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
                    <div className="empty-state">
                      <Award size={28} className="empty-state-icon" style={{ color: 'var(--gold)' }} />
                      <p>Run Talent Check to see candidate readiness compared against standard company skill definitions.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* STEP 5: SKILL MATCHING */}
          {step === 5 && (
            <div className="step-container">
              <div className="step-header">
                <h2>5. Job Description Skill Matching</h2>
                <p>Verify how closely candidate capabilities match parsed keyword parameters from the active Job Description.</p>
              </div>

              <div className="side-by-side-grid">
                <section className="glass-panel" style={{ alignSelf: 'start' }}>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Briefcase size={14} style={{ color: 'var(--gold)' }} />
                    Keyword Relevance Matching
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Compares skills listed on candidate profiles directly against keywords extracted from parsed Job Description files.
                  </p>

                  <button 
                    onClick={handleSkillMatch} 
                    disabled={matchLoading}
                    className="btn btn-primary"
                  >
                    {matchLoading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />} Run Skill Match Check
                  </button>
                </section>

                <section className="glass-panel">
                  {matchResult ? (
                    <div>
                      <div className="skill-match-container" style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
                        {renderSkillMatchRing(matchResult.match_score)}
                        <div className="match-breakdown-details">
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Parsed JD File Source:</p>
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white', wordBreak: 'break-all' }}>{matchResult.jd_source_file}</p>
                        </div>
                      </div>
                      
                      <div 
                        onMouseEnter={() => setHoveredMatchSegment('matched')}
                        onMouseLeave={() => setHoveredMatchSegment('all')}
                        style={{ 
                          opacity: hoveredMatchSegment === 'missing' ? 0.35 : 1, 
                          transition: 'all 0.2s ease',
                          marginBottom: '1rem'
                        }}
                      >
                        <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.25rem' }}>Matched Skills ({matchResult.matched_skills.length})</h4>
                        <div className="skill-chips-list">
                          {matchResult.matched_skills.map((skill, i) => (
                            <span key={i} className="chip chip-matched">{skill}</span>
                          ))}
                          {matchResult.matched_skills.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No direct overlaps found</span>}
                        </div>
                      </div>

                      <div 
                        onMouseEnter={() => setHoveredMatchSegment('missing')}
                        onMouseLeave={() => setHoveredMatchSegment('all')}
                        style={{ 
                          opacity: hoveredMatchSegment === 'matched' ? 0.35 : 1, 
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <h4 style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.25rem' }}>Missing Skills ({matchResult.missing_skills.length})</h4>
                        <div className="skill-chips-list">
                          {matchResult.missing_skills.map((skill, i) => (
                            <span key={i} className="chip chip-missing">{skill}</span>
                          ))}
                          {matchResult.missing_skills.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No gaps detected</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Sliders size={28} className="empty-state-icon" style={{ color: 'var(--gold)' }} />
                      <p>Run the Skill Match analysis to visualize matched vs missing skillsets.</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 3. RIGHT API LOGS DEV CONSOLE PANEL (Collapsed/hidden by default) */}
      <aside className={`api-console-panel ${apiConsoleOpen ? '' : 'collapsed'}`}>
        <div className="api-console-header">
          <h3>
            <Terminal size={12} style={{ color: 'var(--gold)' }} />
            API inspector
          </h3>
          <button 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            onClick={() => setApiConsoleOpen(false)}
          >
            <X size={12} />
          </button>
        </div>

        <div className="api-logs-list">
          {apiLogs.map(log => (
            <div 
              key={log.id} 
              className={`api-log-item ${selectedLog?.id === log.id ? 'selected' : ''}`}
              onClick={() => setSelectedLog(log)}
            >
              <div className="api-log-meta">
                <span className={`api-log-method ${log.method.toLowerCase()}`}>
                  {log.method}
                </span>
                <span className={`api-log-status ${log.status >= 200 && log.status < 300 ? 'success' : 'error'}`}>
                  {log.status === 0 ? 'PENDING' : log.status}
                </span>
              </div>
              <div className="api-log-path">
                {log.path}
              </div>
              <div className="api-log-time">
                {log.timestamp} {log.durationMs > 0 ? `(${log.durationMs}ms)` : ''}
              </div>
            </div>
          ))}
          {apiLogs.length === 0 && (
            <div className="empty-state" style={{ height: '100%' }}>
              <Terminal size={20} className="empty-state-icon" />
              <p style={{ fontSize: '0.7rem' }}>Logs list is empty.</p>
            </div>
          )}
        </div>

        <div className="api-detail-view">
          <div className="api-detail-body">
            {selectedLog ? (
              JSON.stringify({
                Request: selectedLog.requestBody || "None (GET Request)",
                Response: selectedLog.responseBody || "Empty Response"
              }, null, 2)
            ) : (
              "Select a log line to inspect the JSON body payloads."
            )}
          </div>
        </div>
      </aside>

      {/* 4. BOTTOM STATUS BAR */}
      <footer className="bottom-status-bar">
        <div className="status-bar-left">
          <div className="status-bar-item">
            <span style={{ fontWeight: 600, color: 'var(--gold)' }}>RADIX STATUS:</span>
          </div>
          <div className="status-bar-item">
            <div className={`status-dot ${jdParsedFile ? 'active' : ''}`} />
            <span>JD: {jdParsedFile ? jdParsedFile : 'None Ingested'}</span>
          </div>
          <div className="status-bar-item">
            <div className={`status-dot ${resumeParsedFile ? 'active' : ''}`} />
            <span>Resume: {resumeParsedFile ? resumeParsedFile : 'None Ingested'}</span>
          </div>
        </div>
        <div className="status-bar-right">
          <div className="status-progress-dots">
            <div className={`progress-dot ${step === 1 ? 'active' : (jdParsedFile ? 'completed' : '')}`} title="JD Ingestion" />
            <div className={`progress-dot ${step === 2 ? 'active' : (resumeParsedFile ? 'completed' : '')}`} title="Resume Parsing" />
            <div className={`progress-dot ${step === 3 ? 'active' : (completeness > 50 ? 'completed' : '')}`} title="Profile Builder" />
            <div className={`progress-dot ${step === 4 ? 'active' : (talentResult ? 'completed' : '')}`} title="Talent Check" />
            <div className={`progress-dot ${step === 5 ? 'active' : (matchResult ? 'completed' : '')}`} title="Skill Match" />
          </div>
          <button 
            className="status-bar-console-btn"
            onClick={() => setApiConsoleOpen(!apiConsoleOpen)}
            title="Inspect Live API JSON payloads"
          >
            <Terminal size={14} />
          </button>
        </div>
      </footer>

      {/* 5. PRINT-ONLY CANDIDATE READINESS REPORT CONTAINER (Hidden on Screen) */}
      <div className="printable-report-container">
        <div className="printable-report-header">
          <div className="printable-report-title">
            <h1>Radix Talent Match Profile Report</h1>
            <p>Generated candidate analytics, competencies, and readiness benchmarking summary sheet.</p>
          </div>
          <div className="printable-report-date">
            Date: {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="printable-report-section">
          <h3>1. General Candidate Profile Information</h3>
          <div className="printable-grid-2">
            <div>
              <table className="printable-meta-table">
                <tbody>
                  <tr>
                    <th>Name:</th>
                    <td>{profile.name || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Email:</th>
                    <td>{profile.email || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Education:</th>
                    <td>{profile.education || "N/A"}</td>
                  </tr>
                  <tr>
                    <th>Preferred Roles:</th>
                    <td>{(profile.preferred_roles || []).join(', ') || "N/A"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <table className="printable-meta-table">
                <tbody>
                  <tr>
                    <th>Certifications:</th>
                    <td>{(profile.certifications || []).length} parsed</td>
                  </tr>
                  <tr>
                    <th>Internships:</th>
                    <td>{(profile.internships || []).length} parsed</td>
                  </tr>
                  <tr>
                    <th>Hackathons:</th>
                    <td>{(profile.hackathons || []).length} parsed</td>
                  </tr>
                  <tr>
                    <th>Source Document:</th>
                    <td>{profile.cv_file || "Manual Profile Creation"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="printable-report-section">
          <h3>2. Technical Competence & Skill Inventory</h3>
          <p style={{ fontSize: '9pt', color: '#444', marginBottom: '8px' }}>
            Detailed breakdown of parsed skills catalogued by standard RADIX engineering capability categories.
          </p>
          <div className="printable-skills-flex">
            {(profile.skills || []).map((skill, idx) => (
              <span className="printable-skill-tag" key={idx}>
                {skill.skill_name} ({skill.category_code} - confidence: {skill.confidence})
              </span>
            ))}
            {(!profile.skills || profile.skills.length === 0) && (
              <p style={{ fontSize: '9.5pt', fontStyle: 'italic' }}>No skills currently added to profile.</p>
            )}
          </div>
        </div>

        <div className="printable-report-section">
          <h3>3. Live Estimated Skill Levels (1-10 Scale)</h3>
          <table className="printable-meta-table" style={{ marginTop: '8px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '6px' }}>Category</th>
                <th style={{ padding: '6px' }}>Estimated Level</th>
                <th style={{ padding: '6px' }}>Category Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>COD</td>
                <td><strong>{calculatedLevels.COD}</strong> / 10</td>
                <td>Core Coding Proficiency</td>
              </tr>
              <tr>
                <td>DSA</td>
                <td><strong>{calculatedLevels.DSA}</strong> / 10</td>
                <td>Data Structures & Algorithms</td>
              </tr>
              <tr>
                <td>OOD</td>
                <td><strong>{calculatedLevels.OOD}</strong> / 10</td>
                <td>Object Oriented Design</td>
              </tr>
              <tr>
                <td>SWE</td>
                <td><strong>{calculatedLevels.SWE}</strong> / 10</td>
                <td>Software Engineering Principles</td>
              </tr>
              <tr>
                <td>SYSD</td>
                <td><strong>{calculatedLevels.SYSD}</strong> / 10</td>
                <td>System Design & Architecture</td>
              </tr>
              <tr>
                <td>SQL</td>
                <td><strong>{calculatedLevels.SQL}</strong> / 10</td>
                <td>Database Queries & Storage</td>
              </tr>
              <tr>
                <td>AI</td>
                <td><strong>{calculatedLevels.AI}</strong> / 10</td>
                <td>AI & Machine Learning Concepts</td>
              </tr>
              <tr>
                <td>CLOUD</td>
                <td><strong>{calculatedLevels.CLOUD}</strong> / 10</td>
                <td>Cloud Computing Platforms</td>
              </tr>
            </tbody>
          </table>
        </div>

        {talentResult && (
          <div className="printable-report-section">
            <h3>4. Company Readiness Benchmarking</h3>
            <div className="printable-grid-2">
              <div className="printable-score-box">
                <div className="printable-score-value">{talentResult.readiness_score}%</div>
                <div className="printable-score-label">Readiness Fit Bar</div>
                <div style={{ fontSize: '8.5pt', color: '#555', marginTop: '6px' }}>
                  Targeting {talentResult.company} ({talentResult.role})
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: '10pt', margin: '0 0 6px 0', textTransform: 'uppercase' }}>Identified Skill Gaps</h4>
                <div className="printable-gaps-list">
                  {talentResult.skillset_gap.map((item, idx) => (
                    <div className="printable-gap-item" key={idx}>
                      <span>Category: <strong>{item.category_code}</strong></span>
                      <span>Cand: {item.candidate_level} / Bar: {item.required_level}</span>
                      <span className={`printable-gap-status ${item.gap ? 'gap' : 'ready'}`}>
                        {item.gap ? 'GAP' : 'READY'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {matchResult && (
          <div className="printable-report-section" style={{ borderTop: '1.5px solid #111', paddingTop: '15px' }}>
            <h3>5. Specific JD Relevance Overlap</h3>
            <div className="printable-grid-2">
              <div className="printable-score-box" style={{ borderColor: '#555' }}>
                <div className="printable-score-value" style={{ color: 'var(--gold)' }}>{matchResult.match_score}%</div>
                <div className="printable-score-label">Job Match overlap</div>
                <div style={{ fontSize: '8pt', color: '#666', marginTop: '4px' }}>
                  JD File: {matchResult.jd_source_file}
                </div>
              </div>
              <div style={{ fontSize: '9pt' }}>
                <p style={{ margin: '0 0 6px 0' }}><strong>Matched requirements:</strong> {matchResult.matched_skills.join(', ') || "None"}</p>
                <p style={{ margin: '0' }}><strong>Missing requirements:</strong> {matchResult.missing_skills.join(', ') || "None"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
