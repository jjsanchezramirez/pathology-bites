/**
 * AI Response Parser Utilities
 * Handles different AI model response formats and extracts thinking content
 */

export interface ParsedAIResponse {
  content: string
  thinkingContent?: string
  hasThinking: boolean
  originalLength: number
  cleanedLength: number
}

/**
 * Extract actual response from Mistral thinking format
 */
export function extractMistralResponse(content: any): ParsedAIResponse {
  let originalContent = ''
  let cleanedContent = ''
  let thinkingContent = ''

  if (typeof content === 'string') {
    originalContent = content

    // Handle <think> tags format
    if (content.includes('<think>') && content.includes('</think>')) {
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
      if (thinkMatch) {
        thinkingContent = thinkMatch[1].trim()
        cleanedContent = content.split('</think>')[1]
          .replace(/\\boxed\{([^}]+)\}/g, '$1') // Remove \boxed{} formatting
          .trim()
      } else {
        cleanedContent = content
      }
    }
    // Handle <response> tags format
    else if (content.includes('<response>') && content.includes('</response>')) {
      const responseMatch = content.match(/<response>([\s\S]*?)<\/response>/)
      if (responseMatch) {
        cleanedContent = responseMatch[1].trim()
        // Everything before <response> is thinking content
        const beforeResponse = content.split('<response>')[0].trim()
        if (beforeResponse) {
          thinkingContent = beforeResponse
        }
      } else {
        cleanedContent = content
      }
    }
    // Handle LaTeX formatting: \[...\] or \text{...}
    else if (content.includes('\\[') || content.includes('\\text{')) {
      // Extract content from \[...\] format
      const latexMatch = content.match(/\\\[([\s\S]*?)\\\]/)
      if (latexMatch) {
        cleanedContent = latexMatch[1].trim()
        // Everything before the LaTeX is thinking content
        const beforeLatex = content.split('\\[')[0].trim()
        if (beforeLatex && beforeLatex !== '**Summary:**') {
          thinkingContent = beforeLatex.replace(/^\*\*Summary:\*\*\s*/, '').trim()
        }
      } else {
        // Handle \text{...} format
        const textMatch = content.match(/\\text\{([\s\S]*?)\}/)
        if (textMatch) {
          cleanedContent = textMatch[1].trim()
          // Everything before \text{ is thinking content
          const beforeText = content.split('\\text{')[0].trim()
          if (beforeText) {
            thinkingContent = beforeText
          }
        } else {
          cleanedContent = content
        }
      }
    }
    // Handle **Summary:** format
    else if (content.includes('**Summary:**')) {
      const parts = content.split('**Summary:**')
      if (parts.length > 1) {
        thinkingContent = parts[0].trim()
        cleanedContent = parts[1].trim()
      } else {
        cleanedContent = content
      }
    }
    // Handle "In X sentences:" format (common in Magistral models)
    else if (content.includes('In 2-3 sentences:') || content.includes('In summary:')) {
      const patterns = ['In 2-3 sentences:', 'In summary:', 'To summarize:']
      let bestSplit = null
      let bestPattern = null

      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          const parts = content.split(pattern)
          if (parts.length > 1) {
            bestSplit = parts
            bestPattern = pattern
            break
          }
        }
      }

      if (bestSplit && bestPattern) {
        thinkingContent = bestSplit[0].trim()
        cleanedContent = bestSplit[1].trim()
      } else {
        cleanedContent = content
      }
    }
    // Handle escaped text (backslashes)
    else if (content.includes('\\ ')) {
      cleanedContent = content.replace(/\\ /g, ' ').trim()
    }
    else {
      cleanedContent = content
    }

    // Final cleanup for common formatting issues
    cleanedContent = cleanedContent
      .replace(/\\ /g, ' ')  // Remove escaped spaces
      .replace(/\\n/g, '\n') // Convert escaped newlines
      .replace(/^\s*[\[\(].*?[\]\)]\s*$/gm, '') // Remove standalone bracketed content
      .replace(/\\boxed\{([^}]+)\}/g, '$1') // Remove \boxed{} formatting
      .replace(/\\\[([^\]]+)\\\]/g, '$1') // Remove \[...\] formatting
      .replace(/\\text\{([^}]+)\}/g, '$1') // Remove \text{...} formatting
      .trim()

    // Handle duplicate content patterns (like "In 2-3 sentences:" repetition)
    if (cleanedContent.includes('\n\n')) {
      const paragraphs = cleanedContent.split('\n\n').filter(p => p.trim())

      // If we have multiple paragraphs and one starts with "In X sentences:"
      const summaryParagraph = paragraphs.find(p =>
        p.startsWith('In 2-3 sentences:') ||
        p.startsWith('In summary:') ||
        p.startsWith('To summarize:')
      )

      if (summaryParagraph && paragraphs.length > 1) {
        // Use the summary paragraph as the main response
        cleanedContent = summaryParagraph
          .replace(/^In \d+-?\d* sentences?:\s*/i, '')
          .replace(/^In summary:\s*/i, '')
          .replace(/^To summarize:\s*/i, '')
          .trim()

        // The other paragraphs become thinking content
        const otherParagraphs = paragraphs.filter(p => p !== summaryParagraph)
        if (otherParagraphs.length > 0 && !thinkingContent) {
          thinkingContent = otherParagraphs.join('\n\n')
        }
      }
    }
  }
  // Handle array format with thinking and text objects
  else if (Array.isArray(content)) {
    originalContent = JSON.stringify(content)
    
    // Extract thinking content
    const thinkingItems = content.filter(item => item.type === 'thinking')
    if (thinkingItems.length > 0) {
      thinkingContent = thinkingItems
        .map(item => item.thinking?.map(t => t.text).join('\n') || '')
        .join('\n')
        .trim()
    }
    
    // Find the actual text response (not thinking)
    const textResponse = content.find(item => 
      item.type === 'text' && !item.thinking
    )
    
    if (textResponse?.text) {
      cleanedContent = textResponse.text
    } else {
      // Fallback: get the last text item
      const lastTextItem = content.filter(item => item.type === 'text').pop()
      cleanedContent = lastTextItem?.text || JSON.stringify(content)
    }
  }
  // Handle object format
  else if (typeof content === 'object' && content !== null) {
    originalContent = JSON.stringify(content)
    cleanedContent = content.text || content.content || JSON.stringify(content)
  }
  else {
    originalContent = String(content)
    cleanedContent = String(content)
  }

  return {
    content: cleanedContent,
    thinkingContent: thinkingContent || undefined,
    hasThinking: !!thinkingContent,
    originalLength: originalContent.length,
    cleanedLength: cleanedContent.length
  }
}

/**
 * Extract response content from LLAMA API format
 */
export function extractLlamaResponse(data: any): ParsedAIResponse {
  let content = ''
  
  // LLAMA API format: { id, completion_message: { content: { text: "..." } }, metrics }
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text
  }
  // Fallback to OpenAI format
  else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content
  }
  else {
    content = JSON.stringify(data, null, 2)
  }

  return {
    content,
    hasThinking: false,
    originalLength: content.length,
    cleanedLength: content.length
  }
}

/**
 * Generic AI response parser that handles all providers
 */
export function parseAIResponse(data: any, provider: string): ParsedAIResponse {
  switch (provider) {
    case 'mistral':
      if (data.choices?.[0]?.message?.content) {
        return extractMistralResponse(data.choices[0].message.content)
      }
      break
      
    case 'llama':
      return extractLlamaResponse(data)
      
    case 'gemini':
    case 'google':
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const content = data.candidates[0].content.parts[0].text
        return {
          content,
          hasThinking: false,
          originalLength: content.length,
          cleanedLength: content.length
        }
      }
      break
      
    case 'claude':
      if (data.content?.[0]?.text) {
        const content = data.content[0].text
        return {
          content,
          hasThinking: false,
          originalLength: content.length,
          cleanedLength: content.length
        }
      }
      break
      
    case 'chatgpt':
    case 'deepseek':
      if (data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content
        return {
          content,
          hasThinking: false,
          originalLength: content.length,
          cleanedLength: content.length
        }
      }
      break
  }
  
  // Fallback
  const fallbackContent = JSON.stringify(data, null, 2)
  return {
    content: fallbackContent,
    hasThinking: false,
    originalLength: fallbackContent.length,
    cleanedLength: fallbackContent.length
  }
}

/**
 * Check if content contains thinking patterns
 */
export function hasThinkingContent(content: string): boolean {
  return content.includes('<think>') || 
         content.includes('"type": "thinking"') ||
         content.includes('\\boxed{') ||
         content.includes('[thinking]')
}

/**
 * Extract token usage from different API formats
 */
export function extractTokenUsage(data: any, provider: string): any {
  switch (provider) {
    case 'llama':
      if (data.metrics) {
        return {
          input: data.metrics.input_tokens || 0,
          output: data.metrics.output_tokens || 0,
          total: data.metrics.total_tokens || 
                 (data.metrics.input_tokens || 0) + (data.metrics.output_tokens || 0)
        }
      }
      break
      
    case 'gemini':
    case 'google':
      if (data.usageMetadata) {
        return {
          input: data.usageMetadata.promptTokenCount || 0,
          output: data.usageMetadata.candidatesTokenCount || 0,
          total: data.usageMetadata.totalTokenCount || 0
        }
      }
      break
      
    default:
      if (data.usage) {
        return {
          input: data.usage.prompt_tokens || data.usage.input_tokens || 0,
          output: data.usage.completion_tokens || data.usage.output_tokens || 0,
          total: data.usage.total_tokens || 
                 (data.usage.prompt_tokens || data.usage.input_tokens || 0) + 
                 (data.usage.completion_tokens || data.usage.output_tokens || 0)
        }
      }
  }
  
  return null
}
