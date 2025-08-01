'use client'

import { useState } from 'react'
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
  FlaskConicalIcon,
  TestTubeIcon,
  Loader2Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  HelpCircleIcon,
  ExternalLink
} from "lucide-react"
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

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
  const [errors, setErrors] = useState<Partial<Record<keyof LACValues, string>>>({})

  const handleInputChange = (field: keyof LACValues, value: string) => {
    setValues(prev => ({
      ...prev,
      [field]: value === '' ? undefined : parseFloat(value)
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LACValues, string>> = {}

    if (values.pt === undefined || isNaN(values.pt) || values.pt < 0) {
      newErrors.pt = 'Please enter a valid PT value'
    }
    if (values.inr === undefined || isNaN(values.inr) || values.inr < 0) {
      newErrors.inr = 'Please enter a valid INR value'
    }
    if (values.ptt_la === undefined || isNaN(values.ptt_la) || values.ptt_la < 0) {
      newErrors.ptt_la = 'Please enter a valid aPTT value'
    }
    if (values.tt === undefined || isNaN(values.tt) || values.tt < 0) {
      newErrors.tt = 'Please enter a valid TT value'
    }
    if (values.heparin_xa === undefined || isNaN(values.heparin_xa) || values.heparin_xa < 0) {
      newErrors.heparin_xa = 'Please enter a valid Heparin Anti-Xa value'
    }
    if (values.drvvt === undefined || isNaN(values.drvvt) || values.drvvt < 0) {
      newErrors.drvvt = 'Please enter a valid dRVVT Screen value'
    }
    if (values.drvvt_ratio === undefined || isNaN(values.drvvt_ratio) || values.drvvt_ratio < 0) {
      newErrors.drvvt_ratio = 'Please enter a valid dRVVT Confirm Ratio'
    }
    if (values.hex_la_delta === undefined || isNaN(values.hex_la_delta) || values.hex_la_delta < 0) {
      newErrors.hex_la_delta = 'Please enter a valid Hexagonal Phase Delta value'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

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
      heparin_xa: { critical: 1.0 },
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
      if (values.ptt_la > ref.ptt_la.high) {
        report.findings.other.push('PT/INR is prolonged. When seen with a prolonged aPTT, this may indicate a common pathway factor deficiency (II, V, X), multiple factor deficiencies (e.g., liver disease, DIC), or certain anticoagulants.')
      } else {
        report.findings.other.push('PT/INR is prolonged with normal aPTT. This pattern suggests factor VII deficiency, early warfarin effect, or liver dysfunction affecting vitamin K-dependent factors.')
      }
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
      <PublicHero
        title="Lupus Anticoagulant Interpreter"
        description="Enter coagulation test results to generate a comprehensive clinical interpretation for lupus anticoagulant detection with detailed analysis and clinical guidance."
      />

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
                      placeholder="Normal: 9.5-13.5 sec"
                      value={values.pt === undefined ? '' : values.pt}
                      onChange={(e) => handleInputChange('pt', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.pt ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.pt && (
                      <p className="text-sm text-red-600">{errors.pt}</p>
                    )}
                  </div>

                  {/* INR */}
                  <div className="space-y-2">
                    <Label htmlFor="inr" className="text-sm font-medium text-gray-700">
                      INR <span className="text-gray-400 font-normal">(ratio)</span>
                    </Label>
                    <Input
                      id="inr"
                      type="number"
                      step="0.01"
                      placeholder="Normal: <1.2"
                      value={values.inr === undefined ? '' : values.inr}
                      onChange={(e) => handleInputChange('inr', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.inr ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.inr && (
                      <p className="text-sm text-red-600">{errors.inr}</p>
                    )}
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
                      placeholder="Normal: <35 sec"
                      value={values.ptt_la === undefined ? '' : values.ptt_la}
                      onChange={(e) => handleInputChange('ptt_la', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.ptt_la ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.ptt_la && (
                      <p className="text-sm text-red-600">{errors.ptt_la}</p>
                    )}
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
                      placeholder="Normal: <21 sec"
                      value={values.tt === undefined ? '' : values.tt}
                      onChange={(e) => handleInputChange('tt', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.tt ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.tt && (
                      <p className="text-sm text-red-600">{errors.tt}</p>
                    )}
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
                      placeholder="Normal: 0.00 IU/mL"
                      value={values.heparin_xa === undefined ? '' : values.heparin_xa}
                      onChange={(e) => handleInputChange('heparin_xa', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.heparin_xa ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.heparin_xa && (
                      <p className="text-sm text-red-600">{errors.heparin_xa}</p>
                    )}
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
                      placeholder="Normal: <45 sec"
                      value={values.drvvt === undefined ? '' : values.drvvt}
                      onChange={(e) => handleInputChange('drvvt', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.drvvt ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.drvvt && (
                      <p className="text-sm text-red-600">{errors.drvvt}</p>
                    )}
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
                      placeholder="Positive: >1.2, Indeterminate: 1.1-1.2"
                      value={values.drvvt_ratio === undefined ? '' : values.drvvt_ratio}
                      onChange={(e) => handleInputChange('drvvt_ratio', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.drvvt_ratio ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.drvvt_ratio && (
                      <p className="text-sm text-red-600">{errors.drvvt_ratio}</p>
                    )}
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
                      placeholder="Positive: >8 sec"
                      value={values.hex_la_delta === undefined ? '' : values.hex_la_delta}
                      onChange={(e) => handleInputChange('hex_la_delta', e.target.value)}
                      className={`bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary ${
                        errors.hex_la_delta ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.hex_la_delta && (
                      <p className="text-sm text-red-600">{errors.hex_la_delta}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg shadow-lg"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2Icon className="w-5 h-5 animate-spin" />
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

                {/* Results Section - appears in same card */}
                {report && (
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    {/* Overall Result */}
                    <div className={`p-4 rounded-lg border-2 ${getResultColors(report.overall)} mb-6`}>
                      <div className="flex items-center justify-center space-x-3">
                        {getResultIcon(report.overall)}
                        <h3 className="text-xl font-bold text-center">
                          {report.overall.toUpperCase()} for Lupus Anticoagulant
                        </h3>
                      </div>
                    </div>

                    {/* Detailed Findings - Compact */}
                    <div className="space-y-4">
                      {/* aPTT/Hexagonal Phase */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2 text-sm">
                          <TestTubeIcon className="w-4 h-4 text-primary" />
                          <span>aPTT / Hexagonal Phase</span>
                        </h4>
                        <p className="text-gray-700 text-sm leading-relaxed">{report.findings.ptt}</p>
                      </div>

                      {/* dRVVT */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2 text-sm">
                          <FlaskConicalIcon className="w-4 h-4 text-primary" />
                          <span>dRVVT Pathway</span>
                        </h4>
                        <p className="text-gray-700 text-sm leading-relaxed">{report.findings.drvvt}</p>
                      </div>

                      {/* Other Findings */}
                      {report.findings.other.length > 0 && (
                        <div className="bg-blue-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm">Other Findings</h4>
                          <ul className="space-y-1">
                            {report.findings.other.map((finding, index) => (
                              <li key={index} className="text-gray-700 text-sm leading-relaxed flex items-start space-x-2">
                                <span className="text-blue-600 mt-1">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Caveats */}
                      {report.caveats.length > 0 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
                          <h4 className="font-semibold text-yellow-800 mb-2 flex items-center space-x-2 text-sm">
                            <AlertTriangleIcon className="w-4 h-4" />
                            <span>Important Caveats</span>
                          </h4>
                          <ul className="space-y-1">
                            {report.caveats.map((caveat, index) => (
                              <li key={index} className="text-yellow-800 text-sm leading-relaxed flex items-start space-x-2">
                                <span className="text-yellow-600 mt-1">•</span>
                                <span>{caveat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Reset Button */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <Button
                        onClick={() => {
                          setReport(null)
                          setValues({})
                          setErrors({})
                        }}
                        variant="outline"
                        className="w-full border-gray-300 hover:bg-gray-50"
                      >
                        Analyze Another Profile
                      </Button>
                    </div>
                  </div>
                )}

                {/* References Section - within same card */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">References</h3>
                  <div className="text-sm text-gray-600 leading-relaxed flex items-start space-x-2">
                    <a
                      href="https://www.sciencedirect.com/science/article/pii/S1538783622037254"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors mt-0.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <span>
                      Devreese, K. M., de Groot, P. G., de Laat, B., Erkan, D., Favaloro, E. J., Mackie, I., et al. (2020).
                      Guidance from the Scientific and Standardization Committee for lupus anticoagulant/antiphospholipid antibodies
                      of the International Society on Thrombosis and Haemostasis. <em>J Thromb Haemost</em>,
                      18(11), 2828-2839.
                    </span>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
