// src/app/api/debug/anki-files/route.ts
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Get the json/anki directory path
    const ankiDir = path.join(process.cwd(), 'json', 'anki')
    
    // Check if directory exists
    try {
      await fs.access(ankiDir)
    } catch {
      return NextResponse.json([])
    }
    
    // Read directory contents
    const files = await fs.readdir(ankiDir)
    
    // Filter for JSON files only
    const jsonFiles = files.filter(file => file.toLowerCase().endsWith('.json'))
    
    return NextResponse.json(jsonFiles)
  } catch (error) {
    console.error('Error reading Anki files:', error)
    return NextResponse.json(
      { error: 'Failed to read Anki files' },
      { status: 500 }
    )
  }
}