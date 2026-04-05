"use client";

import { Email } from "@/lib/types";
import { X, Mail } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  categoryColor: string;
  emails: Email[];
}

export default function CategoryEmailsModal({
  isOpen,
  onClose,
  categoryName,
  categoryColor,
  emails,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredEmails = emails.filter((email) => {
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.emailAddress.name.toLowerCase().includes(query) ||
      email.from.emailAddress.address.toLowerCase().includes(query) ||
      email.bodyPreview?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] mx-4 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            <div>
              <h2 className="text-lg font-semibold text-white">{categoryName}</h2>
              <p className="text-sm text-slate-400">
                {emails.length} email{emails.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <input
            type="text"
            placeholder="Search emails in this category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {searchQuery
                  ? "No emails match your search"
                  : "No emails in this category"}
              </p>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <div
                key={email.id}
                className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {email.subject}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      <span className="text-slate-300">
                        {email.from.emailAddress.name}
                      </span>
                      <span className="mx-2">&middot;</span>
                      <span>{email.from.emailAddress.address}</span>
                    </p>
                    {email.bodyPreview && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {email.bodyPreview}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {format(
                        new Date(email.receivedDateTime),
                        "MMM d, h:mm a"
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {email.importance === "high" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">
                          High
                        </span>
                      )}
                      {email.hasAttachments && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                          📎
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredEmails.length} of {emails.length} emails
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
