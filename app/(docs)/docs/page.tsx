"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    SwaggerUIBundle: any;
    SwaggerUIStandalonePreset: any;
  }
}

export default function DocsPage() {
  const swaggerContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const initSwagger = () => {
      if (
        !initialized.current &&
        window.SwaggerUIBundle &&
        window.SwaggerUIStandalonePreset &&
        swaggerContainerRef.current
      ) {
        initialized.current = true;
        window.SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            window.SwaggerUIBundle.presets.apis,
            window.SwaggerUIStandalonePreset,
          ],
          layout: "StandaloneLayout",
          persistAuthorization: true,
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 2,
          docExpansion: "list",
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
        });
      }
    };

    if (window.SwaggerUIBundle && window.SwaggerUIStandalonePreset) {
      initSwagger();
    }

    window.addEventListener("swagger-loaded", initSwagger);
    return () => window.removeEventListener("swagger-loaded", initSwagger);
  }, []);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"
      />

      <Script
        src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          const script = document.createElement("script");
          script.src =
            "https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js";
          script.onload = () =>
            window.dispatchEvent(new Event("swagger-loaded"));
          document.body.appendChild(script);
        }}
      />

      <style jsx global>{`
        body {
          margin: 0;
          background: #0a0a0a;
        }

        .swagger-ui {
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
        }

        .swagger-ui .topbar {
          background-color: #111;
          padding: 10px 0;
        }

        .swagger-ui .topbar .download-url-wrapper .select-label {
          color: #e5e5e5;
        }

        .swagger-ui .topbar .download-url-wrapper input[type="text"] {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #fff;
        }

        .swagger-ui .topbar .download-url-wrapper .download-url-button {
          background: #10b981;
          border: none;
        }

        .swagger-ui .info {
          margin: 30px 0;
        }

        .swagger-ui .info .title {
          color: #f5f5f5;
          font-size: 2.5rem;
          font-weight: 700;
        }

        .swagger-ui .info .title small {
          background: #10b981;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.875rem;
          vertical-align: middle;
          margin-left: 10px;
        }

        .swagger-ui .info .description {
          color: #a3a3a3;
          font-size: 1rem;
          line-height: 1.6;
        }

        .swagger-ui .info .description p {
          margin: 0 0 10px;
        }

        .swagger-ui .info .description a {
          color: #10b981;
        }

        .swagger-ui .info .base-url {
          color: #737373;
        }

        .swagger-ui .scheme-container {
          background: #111;
          padding: 15px 0;
          box-shadow: none;
        }

        .swagger-ui .scheme-container .schemes > label {
          color: #a3a3a3;
        }

        .swagger-ui select {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #fff;
        }

        .swagger-ui .btn.authorize {
          background: transparent;
          border-color: #10b981;
          color: #10b981;
        }

        .swagger-ui .btn.authorize:hover {
          background: #10b98120;
        }

        .swagger-ui .btn.authorize svg {
          fill: #10b981;
        }

        .swagger-ui .authorization__btn.locked svg {
          fill: #10b981;
        }

        .swagger-ui .opblock-tag {
          color: #f5f5f5;
          border-bottom: 1px solid #333;
        }

        .swagger-ui .opblock-tag:hover {
          background: #1a1a1a;
        }

        .swagger-ui .opblock-tag small {
          color: #737373;
        }

        .swagger-ui .opblock {
          border-radius: 8px;
          margin-bottom: 10px;
          border: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .swagger-ui .opblock.opblock-get {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #3b82f6;
        }

        .swagger-ui .opblock.opblock-post {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .swagger-ui .opblock.opblock-post .opblock-summary-method {
          background: #10b981;
        }

        .swagger-ui .opblock.opblock-put {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .swagger-ui .opblock.opblock-put .opblock-summary-method {
          background: #f59e0b;
        }

        .swagger-ui .opblock.opblock-patch {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .swagger-ui .opblock.opblock-patch .opblock-summary-method {
          background: #8b5cf6;
        }

        .swagger-ui .opblock.opblock-delete {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
          background: #ef4444;
        }

        .swagger-ui .opblock-summary-method {
          border-radius: 4px;
          padding: 6px 12px;
          font-weight: 600;
          min-width: 70px;
          text-align: center;
        }

        .swagger-ui .opblock-summary-path {
          color: #f5f5f5;
        }

        .swagger-ui .opblock-summary-description {
          color: #a3a3a3;
        }

        .swagger-ui .opblock-description-wrapper p,
        .swagger-ui .opblock-external-docs-wrapper p {
          color: #d4d4d4;
        }

        .swagger-ui .opblock-body {
          background: #0a0a0a;
        }

        .swagger-ui .opblock-section-header {
          background: #111;
          border-bottom: 1px solid #333;
        }

        .swagger-ui .opblock-section-header h4 {
          color: #f5f5f5;
        }

        .swagger-ui table thead tr td,
        .swagger-ui table thead tr th {
          color: #a3a3a3;
          border-bottom: 1px solid #333;
        }

        .swagger-ui .parameter__name {
          color: #f5f5f5;
        }

        .swagger-ui .parameter__name.required::after {
          color: #ef4444;
        }

        .swagger-ui .parameter__type {
          color: #737373;
        }

        .swagger-ui .parameter__deprecated {
          color: #ef4444;
        }

        .swagger-ui .parameter__in {
          color: #737373;
        }

        .swagger-ui input[type="text"],
        .swagger-ui textarea {
          background: #1a1a1a;
          border: 1px solid #333;
          color: #f5f5f5;
          border-radius: 4px;
        }

        .swagger-ui input[type="text"]:focus,
        .swagger-ui textarea:focus {
          border-color: #10b981;
          outline: none;
        }

        .swagger-ui .btn.execute {
          background: #10b981;
          border: none;
          color: #fff;
          border-radius: 4px;
          font-weight: 600;
        }

        .swagger-ui .btn.execute:hover {
          background: #059669;
        }

        .swagger-ui .btn.cancel {
          background: #333;
          border: none;
          color: #fff;
          border-radius: 4px;
        }

        .swagger-ui .btn {
          border-radius: 4px;
        }

        .swagger-ui .responses-inner h4,
        .swagger-ui .responses-inner h5 {
          color: #f5f5f5;
        }

        .swagger-ui .response-col_status {
          color: #f5f5f5;
        }

        .swagger-ui .response-col_description {
          color: #a3a3a3;
        }

        .swagger-ui .model-title {
          color: #f5f5f5;
        }

        .swagger-ui .model {
          color: #d4d4d4;
        }

        .swagger-ui .model-toggle::after {
          background: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23a3a3a3' d='M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'/%3E%3C/svg%3E")
            center no-repeat;
        }

        .swagger-ui .prop-type {
          color: #10b981;
        }

        .swagger-ui .prop-format {
          color: #737373;
        }

        .swagger-ui .model-box {
          background: #111;
          border-radius: 4px;
        }

        .swagger-ui section.models {
          border: 1px solid #333;
          border-radius: 8px;
        }

        .swagger-ui section.models h4 {
          color: #f5f5f5;
        }

        .swagger-ui section.models .model-container {
          background: #111;
          border-radius: 4px;
          margin: 0 10px 10px;
        }

        .swagger-ui .highlight-code {
          background: #111 !important;
        }

        .swagger-ui .highlight-code > .microlight {
          background: #111 !important;
          color: #d4d4d4 !important;
        }

        .swagger-ui pre.microlight {
          background: #111 !important;
          color: #d4d4d4 !important;
          border-radius: 4px;
          padding: 15px;
        }

        .swagger-ui .copy-to-clipboard {
          background: #333;
          border-radius: 4px;
        }

        .swagger-ui .copy-to-clipboard button {
          background: transparent;
        }

        .swagger-ui .download-contents {
          background: #333;
          color: #fff;
          border-radius: 4px;
        }

        .swagger-ui .tab li {
          color: #a3a3a3;
        }

        .swagger-ui .tab li.active {
          color: #f5f5f5;
        }

        .swagger-ui .response-control-media-type__accept-message {
          color: #737373;
        }

        .swagger-ui .loading-container {
          background: #0a0a0a;
        }

        .swagger-ui .loading-container .loading::after {
          color: #a3a3a3;
        }

        .swagger-ui .dialog-ux .modal-ux {
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
        }

        .swagger-ui .dialog-ux .modal-ux-header {
          border-bottom: 1px solid #333;
        }

        .swagger-ui .dialog-ux .modal-ux-header h3 {
          color: #f5f5f5;
        }

        .swagger-ui .dialog-ux .modal-ux-content p {
          color: #a3a3a3;
        }

        .swagger-ui .dialog-ux .modal-ux-content h4 {
          color: #f5f5f5;
        }

        .swagger-ui .auth-container {
          border-bottom: 1px solid #333;
        }

        .swagger-ui .auth-container h4 {
          color: #f5f5f5;
        }

        .swagger-ui .scopes h2 {
          color: #f5f5f5;
        }

        .swagger-ui .errors-wrapper {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
        }

        .swagger-ui .errors-wrapper hgroup h4 {
          color: #ef4444;
        }

        .swagger-ui ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .swagger-ui ::-webkit-scrollbar-track {
          background: #111;
        }

        .swagger-ui ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }

        .swagger-ui ::-webkit-scrollbar-thumb:hover {
          background: #444;
        }

        .swagger-ui .filter-container {
          background: #0a0a0a;
          padding: 10px 0;
        }

        .swagger-ui .filter-container .filter {
          border: 1px solid #333;
          background: #111;
          border-radius: 4px;
        }

        .swagger-ui .filter-container input[type="text"] {
          background: transparent;
          border: none;
        }
      `}</style>

      <div id="swagger-ui" ref={swaggerContainerRef} className="min-h-screen" />
    </>
  );
}
