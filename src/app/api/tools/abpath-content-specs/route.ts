import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Read the content specifications file from data
    const filePath = path.join(process.cwd(), 'data', 'abpath-content-specs.json')
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Content specifications file not found')
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error loading content specifications:', error)
    
    return NextResponse.json(
      { error: 'Failed to load content specifications' },
      { status: 500 }
    )
  }
}
