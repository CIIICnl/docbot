// PDF generation service using Playwright

import type { Browser, Page } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import type { PdfOptions, PdfMetadata } from '../types/index.js';

// Singleton browser instance for performance
let browser: Browser | null = null;

/**
 * Get or create the browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    // Dynamic import to avoid issues when playwright isn't installed
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('PDF browser instance created');
  }
  return browser;
}

/**
 * Add metadata to a PDF buffer for accessibility
 */
async function addPdfMetadata(pdfBuffer: Buffer, metadata: PdfMetadata): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  if (metadata.title) {
    pdfDoc.setTitle(metadata.title);
  }
  if (metadata.author) {
    pdfDoc.setAuthor(metadata.author);
  }
  if (metadata.subject) {
    pdfDoc.setSubject(metadata.subject);
  }
  if (metadata.creator) {
    pdfDoc.setCreator(metadata.creator);
  }
  if (metadata.language) {
    pdfDoc.setLanguage(metadata.language);
  }

  // Set production date
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}

/**
 * Generate a PDF from HTML content
 */
export async function generatePdf(options: PdfOptions): Promise<Buffer> {
  const browserInstance = await getBrowser();
  const page: Page = await browserInstance.newPage();

  try {
    // Set the HTML content
    await page.setContent(options.html, {
      waitUntil: 'networkidle',
    });

    // Configure PDF options
    const pdfOptions: Parameters<Page['pdf']>[0] = {
      format: options.format || 'A4',
      margin: options.margins || {
        top: '2.5cm',
        right: '2cm',
        bottom: '2.5cm',
        left: '2cm',
      },
      printBackground: true,
      preferCSSPageSize: true,
      // Enable tagged PDF for accessibility (adds document structure for screen readers)
      tagged: true,
    };

    // Add page numbers if requested
    if (options.pageNumbers) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<div></div>';
      // Hide page number on first page (cover page) using inline script
      pdfOptions.footerTemplate = `
        <div id="footer" style="font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #666; text-align: center; width: 100%; padding: 0 2cm;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
        <script>
          var pageNum = document.querySelector('.pageNumber');
          if (pageNum && pageNum.textContent === '1') {
            document.getElementById('footer').style.visibility = 'hidden';
          }
        </script>
      `;
      // Adjust margin to accommodate footer
      pdfOptions.margin = {
        ...pdfOptions.margin,
        bottom: '3cm',
      };
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    let result: Buffer = Buffer.from(pdfBuffer);

    // Add PDF metadata if provided
    if (options.metadata) {
      result = await addPdfMetadata(result, options.metadata);
    }

    return result;
  } finally {
    await page.close();
  }
}

/**
 * Generate HTML output (for HTML download)
 */
export async function generateHtml(options: PdfOptions): Promise<string> {
  // For HTML output, we just return the HTML as-is
  return options.html;
}

/**
 * Get the page count from a PDF buffer
 * Simple heuristic based on PDF content
 */
export function estimatePageCount(pdfBuffer: Buffer): number {
  // Count /Page objects in PDF (rough estimate)
  const content = pdfBuffer.toString('binary');
  const matches = content.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

/**
 * Close the browser instance (for graceful shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('PDF browser instance closed');
  }
}

/**
 * Check if the PDF service is available
 */
export async function isPdfServiceAvailable(): Promise<boolean> {
  try {
    await getBrowser();
    return true;
  } catch (error) {
    console.error('PDF service not available:', error);
    return false;
  }
}
