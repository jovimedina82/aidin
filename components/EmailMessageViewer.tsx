/**
 * Email message viewer component
 * Renders sanitized HTML email content with inline images and attachment gallery
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  htmlSanitized?: string;
  textPlain?: string;
  receivedAt: string;
}

interface MessageAsset {
  id: string;
  filename: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  kind: 'inline' | 'attachment' | 'derived';
  variant: 'original' | 'web' | 'thumb';
  url: string;
  createdAt: string;
}

interface EmailMessageViewerProps {
  message: EmailMessage;
  ticketId: string;
}

export function EmailMessageViewer({ message, ticketId }: EmailMessageViewerProps) {
  const [attachmentImages, setAttachmentImages] = useState<MessageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<MessageAsset | null>(null);

  useEffect(() => {
    // Fetch attachment images (non-inline images)
    const fetchAttachments = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/tickets/${ticketId}/message-assets?kind=attachment&onlyImages=true&variant=web`
        );
        const data = await response.json();
        setAttachmentImages(data.assets || []);
      } catch (error) {
        console.error('Failed to fetch attachment images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttachments();
  }, [ticketId, message.id]);

  const handleImageClick = (asset: MessageAsset) => {
    setSelectedImage(asset);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className="email-message-viewer">
      {/* Email metadata */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <div><strong>From:</strong> {message.from}</div>
        <div><strong>Subject:</strong> {message.subject}</div>
        <div><strong>Received:</strong> {new Date(message.receivedAt).toLocaleString()}</div>
      </div>

      {/* Email body with inline images */}
      <CardContent>
        <div className="prose max-w-none email-content">
          {message.htmlSanitized ? (
            <div
              className="email-html-body"
              dangerouslySetInnerHTML={{ __html: message.htmlSanitized }}
              style={{
                maxWidth: '100%',
                overflowWrap: 'break-word',
              }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{message.textPlain}</p>
          )}
        </div>
      </CardContent>

      {/* Attachment images gallery */}
      {attachmentImages.length > 0 && (
        <CardContent className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Message Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {attachmentImages.map((asset) => (
              <div
                key={asset.id}
                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleImageClick(asset)}
              >
                <img
                  src={asset.url}
                  alt={asset.filename}
                  loading="lazy"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {asset.filename}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}

      {/* Full-size image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75"
              onClick={closeModal}
            >
              ✕
            </button>
            <img
              src={selectedImage.url.replace('variant=web', 'variant=original')}
              alt={selectedImage.filename}
              className="max-w-full max-h-screen object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-white text-center mt-4">
              {selectedImage.filename}
            </div>
          </div>
        </div>
      )}

      {/* CSS for email content */}
      <style jsx global>{`
        .email-html-body img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem 0;
        }

        .email-html-body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }

        .dark .email-html-body {
          color: #e5e7eb;
        }

        .email-html-body a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .email-html-body a:hover {
          color: #2563eb;
        }

        .email-html-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }

        .email-html-body th,
        .email-html-body td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        .email-html-body th {
          background-color: #f3f4f6;
          font-weight: bold;
        }

        .dark .email-html-body th {
          background-color: #374151;
        }

        .dark .email-html-body th,
        .dark .email-html-body td {
          border-color: #4b5563;
        }
      `}</style>
    </div>
  );
}
