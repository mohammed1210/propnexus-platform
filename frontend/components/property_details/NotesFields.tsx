'use client';
import React, { useState, useEffect } from 'react';

interface NotesFieldsProps {
  propertyId: string;
}

const NotesFields: React.FC<NotesFieldsProps> = ({ propertyId }) => {
  const [notes, setNotes] = useState('');
  const [customField, setCustomField] = useState('');

  // Load saved data from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`notes-${propertyId}`);
    const savedField = localStorage.getItem(`customField-${propertyId}`);
    if (savedNotes) setNotes(savedNotes);
    if (savedField) setCustomField(savedField);
  }, [propertyId]);

  // Save updates to localStorage
  useEffect(() => {
    localStorage.setItem(`notes-${propertyId}`, notes);
    localStorage.setItem(`customField-${propertyId}`, customField);
  }, [notes, customField, propertyId]);

  return (
    <div className="bg-white dark:bg-neutral-900 shadow-md rounded-md p-5 mt-6">
      <h3 className="text-lg font-semibold mb-4">📝 Investor Notes</h3>
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

      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-neutral-800"
          placeholder="Add your thoughts or deal analysis..."
        />
      </div>
    </div>
  );
};

export default NotesFields;
