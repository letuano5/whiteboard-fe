import { useState } from 'react';

export default function ShareLinkButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        window.prompt('Copy this link:', window.location.href);
      },
    );
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      title="Copy share link"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
