'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import * as THREE from "three"
import { FBXLoader } from "three-stdlib"
import { Loader2 } from "lucide-react"
import gsap from "gsap"

interface BodyPart {
  body_part: string
  intensity: number
  notes: string
}

interface MeshHighlight {
  mesh_id: string
  score: number
}

interface Medication {
  taking: boolean
  name: string
  dose: string | number
  effectiveness: string
}

interface Log {
  _id: string
  patient_email: string
  timestamp: string
  body_parts: BodyPart[]
  general_flag: number
  ai_summary: string
  pdf_data: string
  medication: Medication
  parsed_date?: Date
  mesh_highlights?: MeshHighlight[]
}

interface Record {
  patient_email: string
  context: string
}

type SceneHandle = {
  frameAll: () => void
  frameByName: (name: string | null) => void
  frameByNames: (names: string[]) => void
  getMeshNames: () => string[]
}

export default function ViewPatient() {
  const params = useParams()
  const email = Array.isArray(params.email) ? params.email[0] : params.email
  const decodedEmail = email ? decodeURIComponent(email) : ''

  const [logs, setLogs] = useState<Log[]>([])
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([])
  const [record, setRecord] = useState<Record | null>(null)
  const [loading, setLoading] = useState({
    logs: true,
    record: true
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'records' | 'pain-map'>('overview')
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null)
  
  // Time filter state
  const [timeFilter, setTimeFilter] = useState<'all' | 'year' | 'month' | 'week'>('all')
  const [timeRange, setTimeRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null })
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  
  // 3D model state
  const [fbxPath] = useState("/models/human.fbx")
  const [modelLoading, setModelLoading] = useState(false)
  const sceneRef = useRef<SceneHandle>(null)
  const [painGrades, setPainGrades] = useState<Record<string, number>>({})
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!decodedEmail) return

    // Fetch logs
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/log?patient_email=${decodedEmail}`)
        if (!response.ok) throw new Error('Failed to fetch logs')

        const data = await response.json()
        
        // Process timestamps for consistency
        const processedData = data.map((log: Log) => {
          try {
            let standardTimestamp
            if (log.timestamp.includes("at")) {
              const dateParts = log.timestamp.split(" at ")
              const date = new Date(dateParts[0])
              standardTimestamp = date.toISOString()
            } else {
              standardTimestamp = new Date(log.timestamp).toISOString()
            }

            return {
              ...log,
              timestamp: standardTimestamp,
              parsed_date: new Date(standardTimestamp),
            }
          } catch (error) {
            console.error(`Error parsing timestamp: ${log.timestamp}`, error)
            return {
              ...log,
              parsed_date: new Date(0),
            }
          }
        })

        // Sort by date
        processedData.sort((a: any, b: any) => b.parsed_date - a.parsed_date)
        
        // Extract available years for filtering
        const yearsSet = new Set<number>();
        processedData.forEach((log: Log) => {
          if (log.parsed_date && log.parsed_date.getFullYear() > 2000) {
            yearsSet.add(log.parsed_date.getFullYear());
          }
        });
        
        const years = Array.from(yearsSet).sort((a, b) => b - a); // Sort in descending order
        setAvailableYears(years);
        
        // If no year is selected yet, select the most recent year
        if (years.length > 0 && !selectedYear) {
          setSelectedYear(years[0]);
        }
        
        setLogs(processedData)
        setFilteredLogs(processedData)
        setLoading(prev => ({ ...prev, logs: false }))
      } catch (error) {
        console.error('Error fetching logs:', error)
        setLoading(prev => ({ ...prev, logs: false }))
      }
    }

    // Fetch patient record
    const fetchRecord = async () => {
      try {
        const response = await fetch(`/api/record?patient_email=${decodedEmail}`)
        if (!response.ok) throw new Error('Failed to fetch record')

        const data = await response.json()
        if (data && data.length > 0) {
          setRecord(data[0])
        }
        setLoading(prev => ({ ...prev, record: false }))
      } catch (error) {
        console.error('Error fetching record:', error)
        setLoading(prev => ({ ...prev, record: false }))
      }
    }

    fetchLogs()
    fetchRecord()
  }, [decodedEmail, selectedYear])
  
  // Apply time filters to logs
  useEffect(() => {
    if (logs.length === 0) return;
    
    let filtered = [...logs];
    
    if (timeFilter === 'year' && selectedYear) {
      filtered = filtered.filter(log => 
        log.parsed_date && log.parsed_date.getFullYear() === selectedYear
      );
    } else if (timeFilter === 'month' && selectedYear && selectedMonth !== null) {
      filtered = filtered.filter(log => 
        log.parsed_date && 
        log.parsed_date.getFullYear() === selectedYear &&
        log.parsed_date.getMonth() === selectedMonth
      );
    } else if (timeFilter === 'week') {
      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      filtered = filtered.filter(log => 
        log.parsed_date && log.parsed_date >= oneWeekAgo && log.parsed_date <= now
      );
    }
    
    setFilteredLogs(filtered);
    
    // If the currently selected log isn't in the filtered logs anymore,
    // select the first log in the filtered set (if available)
    if (selectedLog && !filtered.find(log => log._id === selectedLog._id)) {
      setSelectedLog(filtered.length > 0 ? filtered[0] : null);
    }
  }, [logs, timeFilter, selectedYear, selectedMonth, selectedLog]);
  
  // Navigate between logs using arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'pain-map' || filteredLogs.length === 0) return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        
        // Find current index
        const currentIndex = selectedLog 
          ? filteredLogs.findIndex(log => log._id === selectedLog._id)
          : -1;
        
        if (currentIndex === -1) {
          // If no log is selected, select the first one
          setSelectedLog(filteredLogs[0]);
          return;
        }
        
        // Calculate next index
        let nextIndex;
        if (e.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + filteredLogs.length) % filteredLogs.length; // Newer logs (move backward)
        } else {
          nextIndex = (currentIndex + 1) % filteredLogs.length; // Older logs (move forward in array)
        }
        
        setSelectedLog(filteredLogs[nextIndex]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, filteredLogs, selectedLog]);
  
  // When selected log changes, update pain grades for 3D model
  useEffect(() => {
    if (!selectedLog) {
      // Clear highlighting when no log is selected
      setPainGrades({});
      setHighlighted(new Set());
      setSelectedBodyPart(null);
      return;
    }
    
    const newPainGrades: {[key: string]: number} = {};
    const newHighlighted = new Set<string>();
    
    // If we have mesh_highlights, use those directly
    if (selectedLog.mesh_highlights && selectedLog.mesh_highlights.length > 0) {
      selectedLog.mesh_highlights.forEach(highlight => {
        newPainGrades[highlight.mesh_id] = highlight.score;
        newHighlighted.add(highlight.mesh_id);
      });
    } 
    // Fallback to body_parts if no mesh_highlights
    else if (selectedLog.body_parts && selectedLog.body_parts.length > 0) {
      selectedLog.body_parts.forEach(part => {
        // Try to use the body part name directly as mesh ID
        // Note: This is a simplified approach - in practice, you'd need a mapping 
        // between body part names and mesh IDs if they don't match exactly
        newPainGrades[part.body_part] = part.intensity;
        newHighlighted.add(part.body_part);
      });
    }
    
    setPainGrades(newPainGrades);
    setHighlighted(newHighlighted);
    
    // Set the first body part as selected by default
    if (newHighlighted.size > 0 && !selectedBodyPart) {
      setSelectedBodyPart(Array.from(newHighlighted)[0]);
    } else if (newHighlighted.size > 0 && selectedBodyPart && !newHighlighted.has(selectedBodyPart)) {
      // If current selected body part isn't in the new highlighted set, select the first one
      setSelectedBodyPart(Array.from(newHighlighted)[0]);
    } else if (newHighlighted.size === 0) {
      setSelectedBodyPart(null);
    }
  }, [selectedLog, selectedBodyPart]);

  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString)
      return format(date, 'PPpp') // Localized date and time
    } catch (error) {
      return String(dateString)
    }
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-pretty text-3xl font-semibold tracking-tight">Patient Profile</h1>
          <Link 
            href="/admin" 
            className="rounded-md bg-zinc-800 px-4 py-2 text-white hover:bg-zinc-700 transition-colors"
          >
            Back to Admin
          </Link>
        </header>

        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 mb-6">
          <div>
            <h2 className="text-xl font-medium text-zinc-300 mb-2">Patient Information</h2>
            <div className="bg-zinc-900 p-4 rounded-md">
              <p className="text-zinc-200">
                <span className="text-zinc-400">Email: </span>
                {decodedEmail || 'Loading...'}
              </p>
            </div>
          </div>
        </section>

        {/* Tabs for navigation */}
        <div className="flex border-b border-zinc-800 mb-6">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'overview' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'logs' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setActiveTab('logs')}
          >
            Pain Logs
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'pain-map' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setActiveTab('pain-map')}
          >
            Pain Map
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'records' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-zinc-400 hover:text-zinc-200'}`}
            onClick={() => setActiveTab('records')}
          >
            Medical Record
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Summary Card for Logs */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6">
              <h3 className="text-lg font-medium text-zinc-300 mb-4">Pain Log Summary</h3>
              {loading.logs ? (
                <div className="flex items-center gap-3 py-4">
                  <span className="h-3 w-3 animate-ping rounded-full bg-purple-500" />
                  <span className="text-sm text-zinc-300">Loading logs...</span>
                </div>
              ) : logs.length > 0 ? (
                <div>
                  <p className="text-zinc-200 mb-2">
                    <span className="text-zinc-400">Total Logs: </span>
                    {logs.length}
                  </p>
                  <p className="text-zinc-200 mb-2">
                    <span className="text-zinc-400">Latest Log: </span>
                    {logs[0]?.parsed_date ? formatDate(logs[0].parsed_date) : 'N/A'}
                  </p>
                  <p className="text-zinc-200 mb-4">
                    <span className="text-zinc-400">Most Recent Pain Level: </span>
                    {logs[0]?.body_parts[0]?.intensity ?? 'N/A'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('logs')}
                      className="rounded-md bg-purple-600/20 border border-purple-600/40 px-4 py-2 text-purple-200 hover:bg-purple-600/30 transition-colors"
                    >
                      View All Logs
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLog(logs[0]);
                        setActiveTab('pain-map');
                      }}
                      className="rounded-md bg-purple-600/20 border border-purple-600/40 px-4 py-2 text-purple-200 hover:bg-purple-600/30 transition-colors"
                      disabled={!logs[0]}
                    >
                      View Pain Map
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400">No pain logs available for this patient.</p>
              )}
            </div>

            {/* Summary Card for Medical Record */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6">
              <h3 className="text-lg font-medium text-zinc-300 mb-4">Medical Record</h3>
              {loading.record ? (
                <div className="flex items-center gap-3 py-4">
                  <span className="h-3 w-3 animate-ping rounded-full bg-purple-500" />
                  <span className="text-sm text-zinc-300">Loading record...</span>
                </div>
              ) : record ? (
                <div>
                  <p className="text-zinc-200 mb-4">
                    <span className="text-zinc-400">Context: </span>
                    {record.context || 'No context provided'}
                  </p>
                  <button
                    onClick={() => setActiveTab('records')}
                    className="rounded-md bg-purple-600/20 border border-purple-600/40 px-4 py-2 text-purple-200 hover:bg-purple-600/30 transition-colors"
                  >
                    View Full Record
                  </button>
                </div>
              ) : (
                <p className="text-zinc-400">No medical record available for this patient.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="grid md:grid-cols-[2fr_1fr] gap-6">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-lg font-medium text-zinc-300">Pain Log History</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {logs.length} logs found for this patient
                </p>
              </div>
              
              {loading.logs ? (
                <div className="flex items-center justify-center gap-3 p-8">
                  <span className="h-3 w-3 animate-ping rounded-full bg-purple-500" />
                  <span className="text-sm text-zinc-300">Loading logs...</span>
                </div>
              ) : logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-300">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Body Part</th>
                        <th className="px-4 py-2 text-left font-medium">Intensity</th>
                        <th className="px-4 py-2 text-left font-medium">Medication</th>
                        <th className="px-4 py-2 text-left font-medium">Flag</th>
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, index) => (
                          <tr 
                          key={log._id}
                          className={`cursor-pointer transition-colors ${
                            selectedLog?._id === log._id 
                              ? 'bg-purple-600/10 ring-1 ring-inset ring-purple-500/40'
                              : index % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/60'
                          } hover:bg-zinc-800/60`}
                          onClick={() => setSelectedLog(log)}
                          title="Click to view details"
                        >
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {log.parsed_date ? formatDate(log.parsed_date) : log.timestamp}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {log.body_parts[0]?.body_part || 'N/A'}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {log.body_parts[0]?.intensity || 'N/A'}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {log.medication?.taking ? log.medication.name : 'None'}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-zinc-200">
                            {log.general_flag}
                          </td>
                          <td className="border-t border-zinc-800 px-4 py-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                setSelectedLog(log);
                                setActiveTab('pain-map');
                              }}
                              className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-500/20"
                              title="View on 3D pain map"
                            >
                              Pain Map
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-center text-zinc-400">No pain logs available for this patient.</p>
              )}
            </div>
            
            {/* Log Detail Sidebar */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-300">Log Details</h3>
                {selectedLog && (
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="rounded-md px-2 py-1 text-xs text-zinc-300 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800/60"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {selectedLog ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-400">
                      {selectedLog.parsed_date ? formatDate(selectedLog.parsed_date) : selectedLog.timestamp}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-md bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300 ring-1 ring-inset ring-purple-500/30"
                        title="General pain flag (0-10)"
                      >
                        Flag: {selectedLog.general_flag}
                      </span>
                      <button
                        onClick={() => setActiveTab('pain-map')}
                        className="text-xs text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md ring-1 ring-inset ring-purple-500/30 hover:bg-purple-500/20"
                        title="View 3D pain map"
                      >
                        View Pain Map
                      </button>
                    </div>
                  </div>

                  {selectedLog.ai_summary && (
                    <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">AI Summary</div>
                      <p className="text-sm text-zinc-200">{selectedLog.ai_summary}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Body Parts</div>
                    {selectedLog.body_parts?.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {selectedLog.body_parts.map((bp, i) => (
                          <li
                            key={`${bp.body_part}-${i}`}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-200">{bp.body_part}</span>
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                                Intensity {bp.intensity}
                              </span>
                            </div>
                            {bp.notes ? <div className="mt-1 text-[11px] text-zinc-400">"{bp.notes}"</div> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-zinc-400">No body part details</div>
                    )}
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-black/30 p-3">
                    <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Medication</div>
                    {selectedLog.medication?.taking ? (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <dt className="text-zinc-400">Name</dt>
                        <dd className="text-zinc-200">{selectedLog.medication?.name}</dd>
                        <dt className="text-zinc-400">Dose</dt>
                        <dd className="text-zinc-200">{String(selectedLog.medication?.dose)} mg</dd>
                        <dt className="text-zinc-400">Effectiveness</dt>
                        <dd className="text-zinc-200">{selectedLog.medication?.effectiveness}</dd>
                      </dl>
                    ) : (
                      <div className="text-sm text-zinc-400">No medication taken</div>
                    )}
                  </div>

                  {selectedLog.pdf_data && (
                    <a
                      href={selectedLog.pdf_data}
                      className="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View PDF
                      <span aria-hidden>→</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-400">Select a log to view details</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6">
            <h3 className="text-lg font-medium text-zinc-300 mb-4">Medical Record</h3>
            
            {loading.record ? (
              <div className="flex items-center gap-3 py-4">
                <span className="h-3 w-3 animate-ping rounded-full bg-purple-500" />
                <span className="text-sm text-zinc-300">Loading record...</span>
              </div>
            ) : record ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-medium text-zinc-400 mb-2">Patient Context</h4>
                  <div className="bg-zinc-900 rounded-md p-4 whitespace-pre-wrap">
                    {record.context || 'No context provided for this patient.'}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button
                    className="rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-500 transition-colors"
                    onClick={() => {
                      // In a real app, you would implement functionality to edit the record
                      // This is just a placeholder
                      alert('Edit record functionality would go here')
                    }}
                  >
                    Edit Record
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 rounded-md p-4">
                <p className="text-zinc-400">No medical record found for this patient.</p>
                <button
                  className="mt-4 rounded-md bg-purple-600 px-4 py-2 text-white hover:bg-purple-500 transition-colors"
                  onClick={() => {
                    // In a real app, you would implement functionality to create a record
                    // This is just a placeholder
                    alert('Create record functionality would go here')
                  }}
                >
                  Create Record
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Pain Map Tab Content */}
        {activeTab === 'pain-map' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-lg font-medium text-zinc-300">3D Pain Map</h3>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {selectedLog ? `Viewing pain map for log from ${selectedLog.parsed_date ? format(selectedLog.parsed_date, 'PPpp') : selectedLog.timestamp}` : 'Select a log to view pain mapping'}
                </p>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-xs text-zinc-400">
                    <span className="mr-2">Navigate: </span>
                    <button 
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      onClick={() => {
                        if (filteredLogs.length === 0) return;
                        
                        // Find current index
                        const currentIndex = selectedLog 
                          ? filteredLogs.findIndex(log => log._id === selectedLog._id)
                          : -1;
                        
                        if (currentIndex === -1) {
                          // If no log is selected, select the first one
                          setSelectedLog(filteredLogs[0]);
                          return;
                        }
                        
                        // Get previous log (newer)
                        const nextIndex = (currentIndex - 1 + filteredLogs.length) % filteredLogs.length;
                        setSelectedLog(filteredLogs[nextIndex]);
                      }}
                      disabled={filteredLogs.length <= 1}
                      title="Previous log (newer)"
                    >
                      ←
                    </button>
                    <button 
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors ml-1"
                      onClick={() => {
                        if (filteredLogs.length === 0) return;
                        
                        // Find current index
                        const currentIndex = selectedLog 
                          ? filteredLogs.findIndex(log => log._id === selectedLog._id)
                          : -1;
                        
                        if (currentIndex === -1) {
                          // If no log is selected, select the first one
                          setSelectedLog(filteredLogs[0]);
                          return;
                        }
                        
                        // Get next log (older)
                        const nextIndex = (currentIndex + 1) % filteredLogs.length;
                        setSelectedLog(filteredLogs[nextIndex]);
                      }}
                      disabled={filteredLogs.length <= 1}
                      title="Next log (older)"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Time filter bar */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex flex-wrap items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Filter by:</span>
                  <select 
                    className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                  >
                    <option value="all">All Time</option>
                    <option value="year">Year</option>
                    <option value="month">Month</option>
                    <option value="week">Last Week</option>
                  </select>
                </div>
                
                {timeFilter === 'year' && (
                  <select 
                    className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                    value={selectedYear || ''}
                    onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                )}
                
                {timeFilter === 'month' && selectedYear && (
                  <>
                    <select 
                      className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                      value={selectedYear || ''}
                      onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    
                    <select 
                      className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                      value={selectedMonth !== null ? selectedMonth : ''}
                      onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">All Months</option>
                      <option value="0">January</option>
                      <option value="1">February</option>
                      <option value="2">March</option>
                      <option value="3">April</option>
                      <option value="4">May</option>
                      <option value="5">June</option>
                      <option value="6">July</option>
                      <option value="7">August</option>
                      <option value="8">September</option>
                      <option value="9">October</option>
                      <option value="10">November</option>
                      <option value="11">December</option>
                    </select>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {selectedLog && filteredLogs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <span className="text-xs font-medium text-purple-300">
                        {filteredLogs.findIndex(log => log._id === selectedLog._id) + 1}
                      </span>
                      <span className="text-xs text-zinc-400 mx-1">/</span>
                      <span className="text-xs text-zinc-400">{filteredLogs.length}</span>
                    </div>
                    
                    <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500" 
                        style={{ 
                          width: `${((filteredLogs.findIndex(log => log._id === selectedLog._id) + 1) / filteredLogs.length) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <span className="text-xs text-zinc-400">
                  {filteredLogs.length} of {logs.length} logs
                </span>
              </div>
            </div>
            
            <div className="grid md:grid-cols-[300px_1fr] gap-0">
              {/* Pain data panel */}
              <div className="border-r border-zinc-800 p-3 overflow-auto max-h-[550px]">
                {/* Body part details card */}
                {selectedBodyPart && selectedLog && (
                  <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/50 overflow-hidden">
                    <div className="bg-purple-500/20 p-2 border-b border-zinc-700">
                      <h4 className="font-medium text-zinc-200">
                        {selectedBodyPart}
                      </h4>
                    </div>
                    <div className="p-2">
                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-zinc-400">Pain Intensity</span>
                          <span 
                            className="text-sm font-semibold"
                            style={{
                              color: painGrades[selectedBodyPart] > 7 
                                ? '#ef4444' // red for high pain
                                : painGrades[selectedBodyPart] > 3 
                                  ? '#f59e0b' // amber for medium pain
                                  : '#22c55e' // green for low pain
                            }}
                          >
                            {painGrades[selectedBodyPart].toFixed(1)}/10
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div 
                            className="h-1.5 rounded-full" 
                            style={{
                              width: `${painGrades[selectedBodyPart] * 10}%`,
                              background: `linear-gradient(90deg, #fbbf24, #ef4444)`,
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Find if we have any notes for this body part */}
                      {selectedLog.body_parts.find(bp => bp.body_part === selectedBodyPart)?.notes && (
                        <div className="mb-2">
                          <span className="text-xs text-zinc-400">Notes</span>
                          <p className="text-xs text-zinc-300 mt-1 bg-zinc-800/50 p-1.5 rounded border border-zinc-700">
                            "{selectedLog.body_parts.find(bp => bp.body_part === selectedBodyPart)?.notes}"
                          </p>
                        </div>
                      )}
                      
                      <div className="flex justify-center mt-2">
                        <button 
                          className="text-xs text-zinc-300 hover:text-zinc-100 transition-colors"
                          onClick={() => {
                            if (sceneRef.current) {
                              sceneRef.current.frameByName(selectedBodyPart);
                            }
                          }}
                        >
                          Focus on this body part
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-zinc-300 mb-1">Pain Data</h4>
                  {!selectedLog ? (
                    <div className="text-zinc-400 text-xs">
                      Please select a log to view its pain map.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Pain intensity information */}
                      <div className="rounded-md bg-zinc-900 p-2">
                        <div className="mb-1 text-xs font-medium text-zinc-300 flex justify-between items-center">
                          <span>Pain Areas</span>
                          <span className="bg-zinc-800 px-1.5 py-0.5 rounded-full text-[10px]">{highlighted.size}</span>
                        </div>
                        
                        {highlighted.size > 0 ? (
                          <ul className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                            {Array.from(highlighted).map(part => (
                              <li 
                                key={part} 
                                className={`flex justify-between items-center p-1 rounded cursor-pointer text-xs ${
                                  selectedBodyPart === part ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-zinc-800'
                                }`}
                                onClick={() => setSelectedBodyPart(part)}
                              >
                                <span className="text-zinc-300 truncate mr-2">{part}</span>
                                <span 
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                                  style={{
                                    backgroundColor: `rgba(${Math.min(255, painGrades[part] * 25.5)}, ${Math.max(0, 255 - painGrades[part] * 25.5)}, 0, 0.3)`,
                                    color: painGrades[part] > 5 ? 'white' : 'inherit'
                                  }}
                                >
                                  {painGrades[part].toFixed(1)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-zinc-400 text-xs">No pain areas highlighted</div>
                        )}
                      </div>
                      
                      <div className="rounded-md bg-zinc-900 p-2">
                        <div className="mb-1 text-xs font-medium text-zinc-300">Legend</div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="flex items-center space-x-1 text-[10px]">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
                            <span>Low Pain (0)</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px]">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                            <span>High Pain (10)</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <button
                          className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
                          onClick={() => sceneRef.current?.frameAll()}
                        >
                          Reset View
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Log selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium text-zinc-300">Select Log</h4>
                    <div className="text-[10px] text-zinc-400 flex items-center">
                      <span className="mr-1">Date</span>
                      {timeFilter !== 'all' && (
                        <span className="bg-purple-500/20 px-1 rounded text-purple-300 text-[10px]">
                          {timeFilter === 'year' ? selectedYear : 
                           timeFilter === 'month' ? `${selectedMonth !== null ? new Date(0, selectedMonth).toLocaleString('default', {month: 'short'}) : 'All'} ${selectedYear}` : 
                           'Last 7 days'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[140px] overflow-y-auto rounded-md border border-zinc-800">
                    {filteredLogs.length > 0 ? (
                      <ul className="divide-y divide-zinc-800">
                        {filteredLogs.map((log, index) => {
                          // Format the date for display
                          const logDate = log.parsed_date;
                          const formattedDate = logDate ? format(logDate, 'MMM dd') : '';
                          const formattedTime = logDate ? format(logDate, 'HH:mm') : '';
                          
                          return (
                            <li key={log._id}>
                              <button
                                className={`w-full text-left px-2 py-1.5 text-xs ${selectedLog?._id === log._id ? 'bg-purple-500/20 text-purple-200' : 'hover:bg-zinc-800 text-zinc-300'} flex items-center justify-between`}
                                onClick={() => setSelectedLog(log)}
                              >
                                <div className="flex items-center">
                                  <span className="text-[10px] text-zinc-500 mr-1.5 w-4 text-center">{index + 1}</span>
                                  <div className="flex flex-col">
                                    <span>{formattedDate}</span>
                                    <span className="text-[10px] opacity-70">{formattedTime}</span>
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <span className="bg-zinc-800 rounded-full px-1.5 text-[10px] text-zinc-400">
                                    {log.body_parts.length}
                                  </span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="p-2 text-zinc-400 text-xs">No logs available for the selected time period</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 3D Model viewer */}
              <div className="relative h-[550px] bg-zinc-950">
                {modelLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30">
                    <div className="flex items-center gap-2 rounded-md bg-zinc-900/90 px-4 py-2 text-sm text-white">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading 3D model...
                    </div>
                  </div>
                )}
                
                <Canvas
                  camera={{ position: [0, 1.6, 4], fov: 45, near: 0.1, far: 1000 }}
                >
                  <color attach="background" args={["#0b0b0b"]} />
                  <Scene
                    ref={sceneRef}
                    fbxPath={fbxPath}
                    highlighted={highlighted}
                    painGrades={painGrades}
                    onLoadingChange={setModelLoading}
                    onMeshClick={setSelectedBodyPart}
                    selectedBodyPart={selectedBodyPart}
                  />
                  <ambientLight intensity={0.6} />
                  <hemisphereLight args={["#ffffff", "#3a3a3a", 0.6]} />
                  <directionalLight position={[5, 10, 5]} intensity={0.75} />
                  <OrbitControls 
                    makeDefault 
                    enableDamping 
                    dampingFactor={0.1} 
                    minDistance={0.2} 
                  />
                </Canvas>
                
                {/* Navigation controls */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                  <div className="bg-black/60 rounded px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-800 flex items-center">
                    <span className="mr-1">Navigate:</span>
                    <span className="text-purple-300">←</span>
                    <span className="mx-0.5 text-zinc-500">/</span>
                    <span className="text-purple-300">→</span>
                  </div>
                  
                  {selectedLog && filteredLogs.length > 0 && (
                    <div className="bg-black/60 rounded px-2 py-0.5 text-[10px] flex items-center gap-1 border border-zinc-800">
                      <span className="text-zinc-400">Log</span>
                      <span className="text-purple-300 font-medium">{filteredLogs.findIndex(log => log._id === selectedLog._id) + 1}</span>
                      <span className="text-zinc-500">/</span>
                      <span className="text-zinc-400">{filteredLogs.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// Scene component for 3D model
function SceneInner(
  props: {
    fbxPath: string
    highlighted: Set<string>
    painGrades: {[key: string]: number}
    onLoadingChange?: (loading: boolean) => void
    onMeshClick?: (name: string) => void
    selectedBodyPart?: string | null
  },
  ref: React.Ref<SceneHandle>,
) {
  const { fbxPath, highlighted, painGrades, onLoadingChange, onMeshClick, selectedBodyPart } = props
  const groupRef = useRef<THREE.Group>(null)
  const controls = (useThree() as any).controls as import("three-stdlib").OrbitControls | undefined
  const camera = useThree((s) => s.camera)
  const [group, setGroup] = useState<THREE.Group | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [meshNames, setMeshNames] = useState<string[]>([])
  const [hoveredName, setHoveredName] = useState<string | null>(null)

  // Load the FBX model
  useEffect(() => {
    let canceled = false
    setLoading(true)
    setLoadError(null)
    setGroup(null)
    onLoadingChange?.(true) // propagate loading start
    
    const loader = new FBXLoader()
    loader.load(
      fbxPath,
      (g) => {
        if (canceled) return
        setGroup(g)
        setLoading(false)
        onLoadingChange?.(false) // done
      },
      undefined,
      (err) => {
        if (canceled) return
        setLoadError(err as any)
        setLoading(false)
        onLoadingChange?.(false) // done with error
      },
    )
    
    return () => {
      canceled = true
    }
  }, [fbxPath, onLoadingChange])

  // Create a map of meshes by name
  const { meshesByName } = useMemo(() => {
    const map = new Map<string, THREE.Mesh>()
    const names: string[] = []
    
    if (group) {
      let autoIndex = 0
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m: any) => (m?.isMaterial && m.clone ? m.clone() : m))
            } else {
              const m: any = mesh.material
              if (m?.isMaterial && m.clone) {
                mesh.material = m.clone()
              }
            }
          }
          
          let name = mesh.name && mesh.name.trim() ? mesh.name : `Mesh_${autoIndex++}`
          while (map.has(name)) name = `${name}_dup`
          
          map.set(name, mesh)
          mesh.userData.__name = name
          mesh.castShadow = true
          mesh.receiveShadow = true
          names.push(name)
        }
      })
    }
    
    setMeshNames(names)
    return { meshesByName: map, meshNames: names }
  }, [group])

  // Center the model in view when loaded
  useEffect(() => {
    if (!groupRef.current) return
    frameObject(groupRef.current, camera, controls)
  }, [group, camera, controls])

  // Preserve original material colors/emissives
  useEffect(() => {
    meshesByName.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        const m = mat as any
        if (!m) return
        if (!m.userData) m.userData = {}
        
        if ("emissive" in m) {
          if (!m.userData.__origEmissive) {
            m.userData.__origEmissive = m.emissive?.clone?.() ?? new THREE.Color(0x000000)
          }
          if (typeof m.userData.__origEmissiveIntensity === "undefined") {
            m.userData.__origEmissiveIntensity = m.emissiveIntensity ?? 0
          }
        } else if ("color" in m) {
          if (!m.userData.__origColor) {
            m.userData.__origColor = m.color?.clone?.() ?? new THREE.Color(0xffffff)
          }
        }
      })
    })
  }, [meshesByName])

  // Apply highlight colors based on pain intensity
  useEffect(() => {
    meshesByName.forEach((mesh, name) => {
      const isHovered = hoveredName === name
      const active = highlighted.has(name)
      const isSelected = selectedBodyPart === name
      const pain = active ? painGrades[name] ?? 5 : undefined
      
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((mat) => {
        const m = mat as any
        if (!m) return
        
        if ("emissive" in m) {
          const orig = m.userData?.__origEmissive as THREE.Color | undefined
          const origI = m.userData?.__origEmissiveIntensity as number | undefined
          
          if (isSelected) {
            // Make selected body part pulse with a brighter glow
            m.emissive = new THREE.Color("#ffffff")
            m.emissiveIntensity = 0.9
          } else if (isHovered) {
            m.emissive = new THREE.Color("#22c55e") // green
            m.emissiveIntensity = 0.75
          } else if (active) {
            // Interpolate color based on pain grade
            if (typeof pain === "number") {
              // 0: #fbbf24 (orange-400), 10: #ef4444 (red-500)
              const lerpColor = lerpColorHex("#fbbf24", "#ef4444", pain / 10)
              m.emissive = new THREE.Color(lerpColor)
              m.emissiveIntensity = 0.75
            } else {
              m.emissive = new THREE.Color("#ef4444")
              m.emissiveIntensity = 0.75
            }
          } else {
            if (orig) m.emissive = orig instanceof THREE.Color ? orig.clone() : new THREE.Color(orig)
            if (typeof origI === "number") m.emissiveIntensity = origI
          }
          
          m.needsUpdate = true
        } else if ("color" in m) {
          const orig = m.userData?.__origColor as THREE.Color | undefined
          
          if (isSelected) {
            m.color = new THREE.Color("#ffffff")
          } else if (isHovered) {
            m.color = new THREE.Color("#22c55e") // green
          } else if (active) {
            if (typeof pain === "number") {
              const lerpColor = lerpColorHex("#fbbf24", "#ef4444", pain / 10)
              m.color = new THREE.Color(lerpColor)
            } else {
              m.color = new THREE.Color("#ef4444")
            }
          } else if (orig) {
            m.color = orig instanceof THREE.Color ? orig.clone() : new THREE.Color(orig)
          }
          
          m.needsUpdate = true
        }
      })
    })
  }, [meshesByName, highlighted, hoveredName, painGrades, selectedBodyPart])

  // Handle pointer interactions
  const onPointerMove = useCallback((e: any) => {
    const obj = e.object as THREE.Object3D | undefined
    if (!obj) {
      setHoveredName(null)
      return
    }
    const name = ((obj as any).userData && (obj as any).userData.__name) || obj.name || null
    setHoveredName(name)
  }, [])

  const onPointerOut = useCallback(() => setHoveredName(null), [])
  
  const onClick = useCallback((e: any) => {
    const obj = e.object as THREE.Object3D
    if (!obj) return
    
    const name = ((obj as any).userData && (obj as any).userData.__name) || obj.name || null
    if (!name || !highlighted.has(name)) return
    
    // Only allow clicking on highlighted (painful) parts
    if (onMeshClick) {
      onMeshClick(name)
    }
  }, [highlighted, onMeshClick])

  // Expose functions via ref
  useEffect(() => {
    const handle: SceneHandle = {
      frameAll: () => frameObject(groupRef.current, camera, controls),
      frameByName: (name) => {
        if (!name) {
          frameObject(groupRef.current, camera, controls)
          return
        }
        const mesh = meshesByName.get(name)
        if (mesh) frameObject(mesh, camera, controls)
      },
      frameByNames: (names) => {
        if (!names || names.length === 0) {
          frameObject(groupRef.current, camera, controls)
          return
        }
        const box = new THREE.Box3()
        let hasAny = false
        names.forEach((n) => {
          const m = meshesByName.get(n)
          if (m) {
            if (!hasAny) {
              box.setFromObject(m)
              hasAny = true
            } else {
              const b = new THREE.Box3().setFromObject(m)
              box.union(b)
            }
          }
        })
        if (hasAny) frameBox3(box, camera, controls)
      },
      getMeshNames: () => meshNames,
    }
    
    if (typeof ref === "function") ref(handle)
    else if (ref) (ref as any).current = handle
  }, [camera, controls, meshesByName, meshNames, ref])

  return (
    <group ref={groupRef}>
      {loading && (
        <Html center>
          <div className="inline-flex items-center gap-2 rounded-md bg-zinc-900/70 px-3 py-2 text-sm text-white border border-purple-500/30">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading model…
          </div>
        </Html>
      )}
      
      {loadError && (
        <Html center>
          <div className="rounded-md bg-zinc-900/70 px-3 py-2 text-sm text-white border border-purple-500/30">
            Could not load: {String(loadError.message || loadError)}
          </div>
        </Html>
      )}

      {group && (
        <primitive object={group} onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} />
      )}

      {hoveredName && (
        <Html position={[0, 2.2, 0]} center>
          <div className="rounded-md bg-zinc-900/70 px-2 py-1 text-xs text-white border border-zinc-800">
            {hoveredName}
          </div>
        </Html>
      )}
    </group>
  )
}

const Scene = React.forwardRef(SceneInner) as React.ForwardRefExoticComponent<
  Omit<Parameters<typeof SceneInner>[0], "ref"> & React.RefAttributes<SceneHandle>
>

// Helper function to frame a 3D box in view
function frameBox3(box: THREE.Box3, camera: THREE.Camera, controls?: import("three-stdlib").OrbitControls) {
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const maxDim = Math.max(size.x, size.y, size.z)
  const fitOffset = 1.6
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
    ? (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    : Math.PI / 4

  const distance = (maxDim / 2 / Math.tan(fov / 2)) * fitOffset

  const dir = new THREE.Vector3(0, 0.2, 1).normalize()
  const newPos = center.clone().add(dir.multiplyScalar(distance))
  camera.position.copy(newPos)

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }
  camera.lookAt(center)
}

// Helper function to frame a 3D object in view
function frameObject(
  obj: THREE.Object3D | null | undefined,
  camera: THREE.Camera,
  controls?: import("three-stdlib").OrbitControls,
) {
  if (!obj) return
  const box = new THREE.Box3().setFromObject(obj)
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const targetHeight = 2.2
  const scaleFactor = size.y > 0 ? targetHeight / size.y : 1
  const root = obj as THREE.Object3D
  if (root && root.parent === null) {
    root.scale.setScalar(scaleFactor)
    const sbox = new THREE.Box3().setFromObject(root)
    sbox.getSize(size)
    sbox.getCenter(center)
  }

  const maxDim = Math.max(size.x, size.y, size.z)
  const fitOffset = 1.6
  const fov = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
    ? (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    : Math.PI / 4

  const distance = (maxDim / 2 / Math.tan(fov / 2)) * fitOffset

  const dir = new THREE.Vector3(0, 0.2, 1).normalize()
  const newPos = center.clone().add(dir.multiplyScalar(distance))

  camera.position.copy(newPos)

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }

  camera.lookAt(center)
}

// Utility function to interpolate between two hex colors
function lerpColorHex(a: string, b: string, t: number) {
  // a, b: hex color strings, t: 0..1
  const ah = a.replace("#", "")
  const bh = b.replace("#", "")
  const ar = parseInt(ah.substring(0, 2), 16)
  const ag = parseInt(ah.substring(2, 4), 16)
  const ab = parseInt(ah.substring(4, 6), 16)
  const br = parseInt(bh.substring(0, 2), 16)
  const bg = parseInt(bh.substring(2, 4), 16)
  const bb = parseInt(bh.substring(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b_ = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b_.toString(16).padStart(2, "0")}`
}
