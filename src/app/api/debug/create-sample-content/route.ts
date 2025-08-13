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
    const body = await request.json()
    const { filename } = body

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    // Sample educational content structure
    const sampleContent = {
      category: "Anatomic Pathology",
      subject: {
        name: filename.replace('.json', '').replace('-', ' '),
        url: `https://example.com/${filename}`,
        lessons: {
          "lesson-1": {
            name: "Introduction to Histopathology",
            url: "https://example.com/lesson1",
            topics: {
              "topic-1": {
                name: "Basic Tissue Types",
                url: "https://example.com/topic1",
                content: {
                  title: "Basic Tissue Types in Pathology",
                  description: "This lesson covers the four basic tissue types: epithelial, connective, muscle, and nervous tissue.",
                  learning_objectives: [
                    "Identify the four basic tissue types",
                    "Understand the key characteristics of each tissue type",
                    "Recognize normal histologic features"
                  ],
                  key_concepts: {
                    "epithelial_tissue": {
                      definition: "Tissue that covers body surfaces and lines cavities",
                      characteristics: ["Closely packed cells", "Minimal intercellular matrix", "Avascular"],
                      examples: ["Skin epidermis", "Intestinal lining", "Glandular tissue"]
                    },
                    "connective_tissue": {
                      definition: "Tissue that supports and connects other tissues",
                      characteristics: ["Abundant extracellular matrix", "Various cell types", "Well vascularized"],
                      examples: ["Bone", "Cartilage", "Blood", "Adipose tissue"]
                    },
                    "muscle_tissue": {
                      definition: "Contractile tissue responsible for movement",
                      characteristics: ["Elongated cells", "Contractile proteins", "Excitable"],
                      examples: ["Skeletal muscle", "Cardiac muscle", "Smooth muscle"]
                    },
                    "nervous_tissue": {
                      definition: "Specialized tissue for communication and control",
                      characteristics: ["Neurons and glial cells", "Electrical conductivity", "Synaptic transmission"],
                      examples: ["Brain", "Spinal cord", "Peripheral nerves"]
                    }
                  },
                  clinical_correlations: [
                    "Epithelial tumors (carcinomas) are the most common malignancies",
                    "Connective tissue tumors (sarcomas) are less common but often aggressive",
                    "Muscle tissue pathology includes dystrophies and myositis",
                    "Nervous tissue diseases include neurodegenerative disorders"
                  ]
                }
              },
              "topic-2": {
                name: "Cellular Adaptations",
                url: "https://example.com/topic2",
                content: {
                  title: "Cellular Adaptations to Stress",
                  description: "This topic covers how cells adapt to environmental stresses through hypertrophy, hyperplasia, atrophy, and metaplasia.",
                  learning_objectives: [
                    "Define the major types of cellular adaptation",
                    "Understand the mechanisms behind each adaptation",
                    "Recognize pathologic examples of cellular adaptation"
                  ],
                  key_concepts: {
                    "hypertrophy": {
                      definition: "Increase in cell size leading to increased organ size",
                      mechanism: "Increased synthesis of structural proteins",
                      examples: ["Cardiac hypertrophy", "Smooth muscle hypertrophy in hypertension"]
                    },
                    "hyperplasia": {
                      definition: "Increase in the number of cells in an organ or tissue",
                      mechanism: "Increased cell division",
                      examples: ["Endometrial hyperplasia", "Benign prostatic hyperplasia"]
                    },
                    "atrophy": {
                      definition: "Shrinkage in the size of cells by loss of cell substance",
                      mechanism: "Decreased protein synthesis and increased protein degradation",
                      examples: ["Muscle atrophy from disuse", "Brain atrophy in aging"]
                    },
                    "metaplasia": {
                      definition: "Reversible replacement of one differentiated cell type with another",
                      mechanism: "Reprogramming of stem cells",
                      examples: ["Respiratory epithelium in smokers", "Barrett esophagus"]
                    }
                  },
                  clinical_correlations: [
                    "Pathologic hypertrophy can lead to heart failure",
                    "Hyperplasia may predispose to neoplasia",
                    "Severe atrophy can compromise organ function",
                    "Metaplasia may be reversible if inciting stimulus is removed"
                  ]
                }
              }
            }
          },
          "lesson-2": {
            name: "Cell Injury and Death",
            url: "https://example.com/lesson2",
            topics: {
              "topic-3": {
                name: "Mechanisms of Cell Injury",
                url: "https://example.com/topic3",
                content: {
                  title: "Mechanisms and Morphology of Cell Injury",
                  description: "Understanding how cells respond to injury and the morphologic changes that occur.",
                  learning_objectives: [
                    "Identify major causes of cell injury",
                    "Understand cellular responses to injury",
                    "Recognize morphologic changes in injured cells"
                  ],
                  key_concepts: {
                    "causes_of_injury": {
                      definition: "Various factors that can damage cells",
                      categories: ["Hypoxia", "Chemical agents", "Infectious agents", "Physical factors"],
                      examples: ["Ischemia", "Toxins", "Bacteria/viruses", "Trauma/radiation"]
                    },
                    "cellular_responses": {
                      definition: "How cells respond to injurious stimuli",
                      responses: ["Adaptation", "Reversible injury", "Irreversible injury/death"],
                      determinants: ["Nature of injury", "Duration", "Severity", "Cell type"]
                    }
                  },
                  clinical_correlations: [
                    "Myocardial infarction results from hypoxic injury",
                    "Drug toxicity can cause hepatic cell injury",
                    "Radiation therapy causes DNA damage"
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
      Body: JSON.stringify(sampleContent, null, 2),
      ContentType: 'application/json'
    })

    await r2Client.send(command)

    return NextResponse.json({
      success: true,
      message: `Sample content file ${filename} created successfully`,
      filename: filename,
      path: `context/${filename}`
    })

  } catch (error) {
    console.error('Error creating sample content:', error)
    return NextResponse.json({
      error: 'Failed to create sample content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}