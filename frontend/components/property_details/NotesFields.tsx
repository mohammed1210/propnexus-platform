'use client';
import React, { useState, useEffect } from 'react';

interface NotesFieldsProps {
  propertyId: string;
}

const NotesFields: React.FC<NotesFieldsProps> = ({ propertyId }) => {
  const [notes, setNotes] = useState('');
  const [customField, setCustomField] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // ✅ Save indicator
  const maxChars = 1000; // ✅ Character limit

  // Load saved data from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`notes-${propertyId}`);
    const savedField = localStorage.getItem(`customField-${propertyId}`);
    if (savedNotes) setNotes(savedNotes);
    if (savedField) setCustomField(savedField);
  }, [propertyId]);

  // Save updates to localStorage with visual feedback
  useEffect(() => {
    if (notes || customField) {
      setSaveStatus('Saving...');
      localStorage.setItem(`notes-${propertyId}`, notes);
      localStorage.setItem(`customField-${propertyId}`, customField);
      setTimeout(() => {
        setSaveStatus(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }, 300);
    }
  }, [notes, customField, propertyId]);

  // ✅ Copy notes to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(notes);
    alert('Notes copied to clipboard!');
  };

  // ✅ Download notes as .txt
  const handleDownload = () => {
    const blob = new Blob([`Custom Field: ${customField}\n\nNotes:\n${notes}`], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notes-${propertyId}.txt`;
    link.click();
  };

  // ✅ Clear all notes
  const handleClear = () => {
    if (confirm('Clear all notes for this property?')) {
      setCustomField('');
      setNotes('');
      localStorage.removeItem(`notes-${propertyId}`);
      localStorage.removeItem(`customField-${propertyId}`);
      setSaveStatus('Cleared');
    }
  };

  // ✅ Quick insert tags
  const quickTags = ['#Refurb', '#Risks', '#Opportunities', '#FollowUp'];

  return (
    <div className="bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">📝 Investor Notes</h3>

      {/* Custom Field */}
      <div className="mb-4">
        <label className="block text-sm font-medium">Custom Field</label>
        <input
          type="text"
          value={customField}
          onChange={(e) => setCustomField(e.target.value)}
          className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          placeholder="e.g. Potential refurb cost, contact, etc."
        />
      </div>

      {/* Quick Tags */}
      <div className="mb-3">
        {quickTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="text-xs bg-gray-200 dark:bg-neutral-700 px-2 py-1 rounded mr-2 mb-2 hover:bg-gray-300"
            onClick={() => setNotes((prev) => prev + (prev ? ' ' : '') + tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Notes Field */}
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) setNotes(e.target.value);
          }}
          rows={4}
          className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          placeholder="Add your thoughts or deal analysis..."
        />
        <div className="flex justify-between text-xs mt-1 text-gray-500">
          <span>{saveStatus}</span>
          <span>{notes.length}/{maxChars} chars</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button onClick={handleCopy} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
          Copy
        </button>
        <button onClick={handleDownload} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
          Download
        </button>
        <button onClick={handleClear} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
          Clear
        </button>
      </div>
    </div>
  );
};

export default NotesFields;
