// src/pages/_error.tsx
import { NextPageContext } from 'next'

interface ErrorProps {
  statusCode?: number
  hasGetInitialProps?: boolean
  err?: Error
}

function Error({ statusCode, hasGetInitialProps, err }: ErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {statusCode ? `${statusCode}` : 'Client-side error occurred'}
        </h1>
        <p className="text-muted-foreground">
          {statusCode
            ? `A ${statusCode} error occurred on server`
            : 'A client-side exception has occurred'}
        </p>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
