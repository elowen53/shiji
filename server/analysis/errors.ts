export class AnalysisError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AnalysisError'
    this.status = status
    this.code = code
  }
}

export function publicError(error: unknown): AnalysisError {
  return error instanceof AnalysisError
    ? error
    : new AnalysisError(503, 'DATA_UNAVAILABLE', 'Analysis data is temporarily unavailable.')
}
