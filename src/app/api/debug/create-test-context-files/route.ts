import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// R2 configuration for educational content data bucket
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    // List of files that the content selector expects
    const testFiles = [
      'ap-general-topics.json',
      'ap-bone.json', 
      'ap-breast.json',
      'ap-gastrointestinal.json',
      'cp-clinical-chemistry.json'
    ]

    const results = []

    for (const filename of testFiles) {
      // Generate simple test content structure for each file
      const isAP = filename.startsWith('ap-')
      const subject = filename.replace(/^(ap-|cp-)/, '').replace('.json', '').replace(/-/g, ' ')
      
      const testContent = {
        category: isAP ? "Anatomic Pathology" : "Clinical Pathology",
        subject: {
          name: subject.replace(/\b\w/g, l => l.toUpperCase()),
          url: `https://example.com/${filename}`,
          lessons: {
            "lesson-1": {
              name: "Introduction",
              url: "https://example.com/lesson1",
              topics: {
                "topic-1": {
                  name: "Basic Concepts",
                  url: "https://example.com/topic1",
                  content: {
                    title: `Introduction to ${subject.replace(/\b\w/g, l => l.toUpperCase())}`,
                    description: `This lesson covers the fundamental concepts of ${subject}.`,
                    learning_objectives: [
                      `Understand the basic principles of ${subject}`,
                      `Identify key features and characteristics`,
                      `Recognize clinical significance and applications`
                    ],
                    key_concepts: {
                      "concept_1": {
                        definition: `Primary concept in ${subject}`,
                        characteristics: ["Key feature 1", "Key feature 2", "Key feature 3"],
                        examples: ["Example A", "Example B", "Example C"]
                      },
                      "concept_2": {
                        definition: `Secondary concept in ${subject}`,
                        characteristics: ["Important aspect 1", "Important aspect 2"],
                        examples: ["Case 1", "Case 2"]
                      }
                    },
                    clinical_correlations: [
                      `Clinical application 1 of ${subject}`,
                      `Clinical application 2 of ${subject}`,
                      `Diagnostic significance in ${subject}`
                    ]
                  }
                },
                "topic-2": {
                  name: "Advanced Topics",
                  url: "https://example.com/topic2",
                  content: {
                    title: `Advanced ${subject.replace(/\b\w/g, l => l.toUpperCase())} Concepts`,
                    description: `This topic covers advanced concepts and applications in ${subject}.`,
                    learning_objectives: [
                      `Master advanced techniques in ${subject}`,
                      `Understand complex pathological processes`,
                      `Apply knowledge to clinical scenarios`
                    ],
                    key_concepts: {
                      "advanced_concept": {
                        definition: `Advanced aspect of ${subject}`,
                        characteristics: ["Complex feature 1", "Complex feature 2"],
                        examples: ["Advanced case A", "Advanced case B"]
                      }
                    },
                    clinical_correlations: [
                      `Advanced clinical correlation in ${subject}`,
                      `Research applications of ${subject}`
                    ]
                  }
                }
              }
            },
            "lesson-2": {
              name: "Clinical Applications",
              url: "https://example.com/lesson2",
              topics: {
                "topic-3": {
                  name: "Case Studies",
                  url: "https://example.com/topic3",
                  content: {
                    title: `${subject.replace(/\b\w/g, l => l.toUpperCase())} Case Studies`,
                    description: `Real-world case studies demonstrating ${subject} applications.`,
                    learning_objectives: [
                      `Analyze real clinical cases`,
                      `Apply theoretical knowledge practically`,
                      `Develop diagnostic reasoning skills`
                    ],
                    key_concepts: {
                      "case_analysis": {
                        definition: "Systematic approach to case analysis",
                        characteristics: ["Observation", "Analysis", "Interpretation"],
                        examples: ["Case study 1", "Case study 2"]
                      }
                    },
                    clinical_correlations: [
                      "Practical diagnostic applications",
                      "Treatment implications",
                      "Prognostic considerations"
                    ]
                  }
                }
              }
            }
          }
        }
      }

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: 'pathology-bites-data',
        Key: `context/${filename}`,
        Body: JSON.stringify(testContent, null, 2),
        ContentType: 'application/json'
      })

      await r2Client.send(command)
      results.push(filename)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${results.length} test context files`,
      files: results
    })

  } catch (error) {
    console.error('Error creating test context files:', error)
    return NextResponse.json({
      error: 'Failed to create test context files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}