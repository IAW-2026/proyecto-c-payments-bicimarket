"use client"
import React from "react"
import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

export default function ApiDocsPage() {
  return (
    <>
      <style>{`
        .api-docs-container {
          height: 100vh;
          overflow-y: auto;
          color-scheme: light;
          background: #fff;
          color: #1a1a1a;
        }
        .api-docs-container .swagger-ui {
          color-scheme: light;
        }
        .api-docs-container .swagger-ui .topbar { display: none; }
      `}</style>
      <div className="api-docs-container">
        <SwaggerUI url="/docs/openapi.yaml" />
      </div>
    </>
  )
}
