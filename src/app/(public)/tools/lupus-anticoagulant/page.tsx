'use client'

import { useState } from 'react'
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import Link from "next/link"
import { 
  FlaskConicalIcon, 
  TestTubeIcon, 
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  HelpCircleIcon
} from "lucide-react"

interface LACValues {
  pt: number
  inr: number
  ptt_la: number
  tt: number
  heparin_xa: number
  drvvt: number
  drvvt_ratio: number
  hex_la_delta: number
}

interface LACReport {
  overall: 'Negative' | 'Positive' | 'Indeterminate' | 'Uninterpretable'
  findings: {
    ptt: string
    drvvt: string
    other: string[]
  }
  caveats: string[]
}

export default function LupusAnticoagulantPage() {
  const [values, setValues] = useState<Partial<LACValues>>({})
  const [report, setReport] = useState<LACReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleInputChange = (field: keyof LACValues, value: string) => {
    setValues(prev => ({
      ...prev,
      [field]: value === '' ? undefined : parseFloat(value)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAnalyzing(true)
    
    // Simulate analysis delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const result = generateLupusAnticoagulantReport(values as LACValues)
    setReport(result)
    setIsAnalyzing(false)
  }

  const generateLupusAnticoagulantReport = (values: LACValues): LACReport => {
    const ref = {
      pt: { low: 9.5, high: 13.5 },
      inr: { high: 1.2 },
      ptt_la: { high: 35 },
      tt: { high: 21 },
      heparin_xa: { critical: 1.5 },
      drvvt: { high: 45 },
      drvvt_ratio: { indeterminate: 1.1, positive: 1.2 },
      hex_la_delta: { positive: 8 }
    }

    const report: LACReport = {
      overall: 'Negative',
      findings: {
        ptt: '',
        drvvt: '',
        other: []
      },
      caveats: []
    }

    let isLACPositive = false
    let isLACIndeterminate = false

    // Critical interference checks
    if (values.inr > 3.5) {
      report.caveats.push(`High INR (${values.inr.toFixed(2)}) significantly interferes with phospholipid-dependent clotting assays. Interpretation for LAC is unreliable. This may be due to warfarin or DOACs.`)
      report.overall = 'Uninterpretable'
      return report
    }

    if (values.heparin_xa >= ref.heparin_xa.critical) {
      report.caveats.push(`High heparin anti-Xa level (${values.heparin_xa.toFixed(2)} IU/mL) significantly interferes with clotting assays. Interpretation for LAC is unreliable.`)
      report.overall = 'Uninterpretable'
      return report
    }

    if (values.tt > 50) {
      report.caveats.push(`Markedly prolonged Thrombin Time (${values.tt.toFixed(1)}s) suggests presence of a direct thrombin inhibitor (e.g., Dabigatran) or high-dose heparin, making LAC assessment unreliable.`)
      report.overall = 'Uninterpretable'
      return report
    }

    // Warning level interferences
    if (values.inr > ref.inr.high) {
      report.caveats.push(`INR is elevated (${values.inr.toFixed(2)}), which can be caused by anticoagulants (Warfarin, DOACs), liver disease, or factor deficiencies. This may influence results.`)
    }

    if (values.heparin_xa > 0.1) {
      report.caveats.push(`Heparin effect is present (Anti-Xa: ${values.heparin_xa.toFixed(2)} IU/mL). While assays are designed to mitigate this, a strong effect can still influence results.`)
    }

    if (values.tt > ref.tt.high && values.heparin_xa < 0.1) {
      report.caveats.push(`Thrombin Time is prolonged (${values.tt.toFixed(1)}s) in the absence of significant heparin, suggesting potential direct thrombin inhibitor, dysfibrinogenemia, or DIC.`)
    }

    // aPTT/Hexagonal Phase Analysis
    if (values.ptt_la > ref.ptt_la.high) {
      if (values.hex_la_delta > ref.hex_la_delta.positive) {
        report.findings.ptt = 'aPTT is prolonged and demonstrates correction in the hexagonal phase assay. This finding is POSITIVE for a lupus anticoagulant.'
        isLACPositive = true
      } else {
        report.findings.ptt = 'aPTT is prolonged but does not correct in the hexagonal phase assay. This is more suggestive of a factor deficiency (intrinsic pathway), a specific factor inhibitor, or an anticoagulant effect rather than a typical lupus anticoagulant.'
      }
    } else {
      report.findings.ptt = 'aPTT is within the normal range.'
    }

    // dRVVT Analysis
    if (values.drvvt > ref.drvvt.high) {
      if (values.drvvt_ratio > ref.drvvt_ratio.positive) {
        report.findings.drvvt = 'The dRVVT screen is prolonged with a positive confirm ratio. This finding is POSITIVE for a lupus anticoagulant.'
        isLACPositive = true
      } else if (values.drvvt_ratio > ref.drvvt_ratio.indeterminate) {
        report.findings.drvvt = 'The dRVVT screen is prolonged with an indeterminate confirm ratio. This result is equivocal and may represent a weak lupus anticoagulant or interference from other factors.'
        isLACIndeterminate = true
      } else {
        report.findings.drvvt = 'The dRVVT screen is prolonged but the confirm ratio is negative. This suggests a coagulation factor deficiency (common pathway) or a specific factor inhibitor rather than a lupus anticoagulant.'
      }
    } else {
      report.findings.drvvt = 'The dRVVT screen is within the normal range.'
    }

    // Other findings
    if (values.pt > ref.pt.high) {
      report.findings.other.push('PT/INR is prolonged. When seen with a prolonged aPTT, this may indicate a common pathway factor deficiency (II, V, X), multiple factor deficiencies (e.g., liver disease, DIC), or certain anticoagulants.')
    }

    // Final determination
    if (isLACPositive) {
      report.overall = 'Positive'
    } else if (isLACIndeterminate) {
      report.overall = 'Indeterminate'
    }

    if (report.overall === 'Negative' && report.caveats.length > 0) {
      report.overall = 'Indeterminate'
      report.caveats.push('The final result is indeterminate due to the presence of anticoagulants or other interfering factors, despite individual pathways being negative.')
    }

    return report
  }

  const getResultIcon = (overall: string) => {
    switch (overall) {
      case 'Positive':
        return <XCircleIcon className="w-6 h-6" />
      case 'Negative':
        return <CheckCircleIcon className="w-6 h-6" />
      case 'Indeterminate':
        return <HelpCircleIcon className="w-6 h-6" />
      case 'Uninterpretable':
        return <AlertTriangleIcon className="w-6 h-6" />
      default:
        return null
    }
  }

  const getResultColors = (overall: string) => {
    switch (overall) {
      case 'Positive':
        return 'bg-red-50 text-red-800 border-red-200'
      case 'Negative':
        return 'bg-green-50 text-green-800 border-green-200'
      case 'Indeterminate':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200'
      case 'Uninterpretable':
        return 'bg-gray-50 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-primary/10 rounded-full">
                <FlaskConicalIcon className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">
              Advanced Lupus Anticoagulant Interpreter
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Enter coagulation test results to generate a comprehensive clinical interpretation 
              for lupus anticoagulant detection with detailed analysis and clinical guidance.
            </p>
          </div>
        </div>
      </section>

      {/* Tool Section */}
      <section className="relative py-16">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 max-w-4xl relative">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PT */}
                  <div className="space-y-2">
                    <Label htmlFor="pt" className="text-sm font-medium text-gray-700">
                      PT (Prothrombin Time) <span className="text-gray-400 font-normal">(sec)</span>
                    </Label>
                    <Input
                      id="pt"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 12.5"
                      value={values.pt || ''}
                      onChange={(e) => handleInputChange('pt', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* INR */}
                  <div className="space-y-2">
                    <Label htmlFor="inr" className="text-sm font-medium text-gray-700">
                      INR <span className="text-gray-400 font-normal">(ratio)</span>
                    </Label>
                    <Input
                      id="inr"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 1.1"
                      value={values.inr || ''}
                      onChange={(e) => handleInputChange('inr', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* aPTT */}
                  <div className="space-y-2">
                    <Label htmlFor="ptt_la" className="text-sm font-medium text-gray-700">
                      aPTT (Lupus Sensitive) <span className="text-gray-400 font-normal">(sec)</span>
                    </Label>
                    <Input
                      id="ptt_la"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 45.2"
                      value={values.ptt_la || ''}
                      onChange={(e) => handleInputChange('ptt_la', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* TT */}
                  <div className="space-y-2">
                    <Label htmlFor="tt" className="text-sm font-medium text-gray-700">
                      TT (Thrombin Time) <span className="text-gray-400 font-normal">(sec)</span>
                    </Label>
                    <Input
                      id="tt"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 18.0"
                      value={values.tt || ''}
                      onChange={(e) => handleInputChange('tt', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* Heparin Anti-Xa */}
                  <div className="space-y-2">
                    <Label htmlFor="heparin_xa" className="text-sm font-medium text-gray-700">
                      Heparin Anti-Xa <span className="text-gray-400 font-normal">(IU/mL)</span>
                    </Label>
                    <Input
                      id="heparin_xa"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 0.00"
                      value={values.heparin_xa || ''}
                      onChange={(e) => handleInputChange('heparin_xa', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* dRVVT Screen */}
                  <div className="space-y-2">
                    <Label htmlFor="drvvt" className="text-sm font-medium text-gray-700">
                      dRVVT Screen <span className="text-gray-400 font-normal">(sec)</span>
                    </Label>
                    <Input
                      id="drvvt"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 52.1"
                      value={values.drvvt || ''}
                      onChange={(e) => handleInputChange('drvvt', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* dRVVT Confirm Ratio */}
                  <div className="space-y-2">
                    <Label htmlFor="drvvt_ratio" className="text-sm font-medium text-gray-700">
                      dRVVT Confirm Ratio <span className="text-gray-400 font-normal">(ratio)</span>
                    </Label>
                    <Input
                      id="drvvt_ratio"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1.52"
                      value={values.drvvt_ratio || ''}
                      onChange={(e) => handleInputChange('drvvt_ratio', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>

                  {/* Hexagonal Phase Delta */}
                  <div className="space-y-2">
                    <Label htmlFor="hex_la_delta" className="text-sm font-medium text-gray-700">
                      Hexagonal Phase Delta <span className="text-gray-400 font-normal">(sec)</span>
                    </Label>
                    <Input
                      id="hex_la_delta"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 10.5"
                      value={values.hex_la_delta || ''}
                      onChange={(e) => handleInputChange('hex_la_delta', e.target.value)}
                      className="bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transform hover:scale-105 transition-all duration-300 ease-in-out shadow-lg"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <div className="flex items-center justify-center space-x-2">
                        <ActivityIcon className="w-5 h-5 animate-spin" />
                        <span>Analyzing Profile...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <TestTubeIcon className="w-5 h-5" />
                        <span>Analyze Profile</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {report && (
        <section className="relative py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8">
                {/* Overall Result */}
                <div className={`p-6 rounded-xl border-2 ${getResultColors(report.overall)} mb-8`}>
                  <div className="flex items-center justify-center space-x-3">
                    {getResultIcon(report.overall)}
                    <h3 className="text-2xl font-bold text-center">
                      {report.overall.toUpperCase()} for Lupus Anticoagulant
                    </h3>
                  </div>
                </div>

                {/* Detailed Findings */}
                <div className="space-y-6">
                  {/* aPTT/Hexagonal Phase */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                      <TestTubeIcon className="w-5 h-5 text-primary" />
                      <span>aPTT / Hexagonal Phase Pathway</span>
                    </h4>
                    <p className="text-gray-700 leading-relaxed">{report.findings.ptt}</p>
                  </div>

                  {/* dRVVT */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                      <FlaskConicalIcon className="w-5 h-5 text-primary" />
                      <span>dRVVT Pathway</span>
                    </h4>
                    <p className="text-gray-700 leading-relaxed">{report.findings.drvvt}</p>
                  </div>

                  {/* Other Findings */}
                  {report.findings.other.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Other Findings</h4>
                      <ul className="space-y-2">
                        {report.findings.other.map((finding, index) => (
                          <li key={index} className="text-gray-700 leading-relaxed flex items-start space-x-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Caveats */}
                  {report.caveats.length > 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6">
                      <h4 className="font-semibold text-yellow-800 mb-3 flex items-center space-x-2">
                        <AlertTriangleIcon className="w-5 h-5" />
                        <span>Important Caveats & Interferences</span>
                      </h4>
                      <ul className="space-y-2">
                        {report.caveats.map((caveat, index) => (
                          <li key={index} className="text-yellow-800 leading-relaxed flex items-start space-x-2">
                            <span className="text-yellow-600 mt-1">•</span>
                            <span>{caveat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Reset Button */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      setReport(null)
                      setValues({})
                    }}
                    variant="outline"
                    className="w-full border-gray-300 hover:bg-gray-50"
                  >
                    Analyze Another Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Join Our Discord Section */}
      <section className="relative py-20 bg-primary">
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Join Our Discord</h2>
          <p className="text-xl mb-8 leading-relaxed text-white">
            Connect with fellow pathology learners, share knowledge, and get quick answers to your questions in our active Discord community.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-gray-100 font-semibold px-8 py-3"
          >
            <Link href="https://discord.gg/pathology-bites" target="_blank" rel="noopener noreferrer">
              Join Discord Server
            </Link>
          </Button>
        </div>
      </section>

      {/* Join Our Learning Community Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Our Learning Community</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Ready to take your pathology education to the next level? Create a free account and access our comprehensive question bank, interactive quizzes, and study tools.
          </p>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 transform hover:scale-105
                        transition-all duration-300 ease-in-out"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
