'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Client, Account, Teams, Databases, Query, ID, Storage } from 'appwrite';
import Link from 'next/link';
import { Tabs, Tab, Card, CardBody } from '@heroui/react';
import { toast } from 'react-hot-toast';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const account = new Account(client);
const teams = new Teams(client);
const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = 'learning_spaces';
const CHAPTERS_COLLECTION_ID = 'chapters';
const FLASHCARDS_COLLECTION_ID = 'flashcards';
const QUIZZES_COLLECTION_ID = 'quizzes';
const AUDIOBOOKS_COLLECTION_ID = 'audiobooks';
const STORYBOARDS_COLLECTION_ID = 'storyboards';
const WEB_NOTES_COLLECTION_ID = 'webnotes';

// This is the new, self-contained, and corrected modal component.
// It is now defined outside the main page component to avoid re-definitions on re-renders.
const ImportWebsiteModal = ({ isOpen, onClose, onNotesGenerated }) => {
    const [url, setUrl] = useState('');
    const [pages, setPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const handleFetchPages = async (e) => {
        if (e) e.preventDefault();
        if (!url) return;
        
        setIsLoading(true);
        setError('');
        setPages([]);
        setSelectedPage('');

        try {
            const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/tavily-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await response.json();
            
            if (response.ok && data.status === 'success' && data.data?.results?.length > 0) {
                setPages(data.data.results);
            } else {
                const errorMessage = data.message || '';
                if (errorMessage.includes('No URLs found') || data.data?.results?.length === 0) {
                    setError("No Links ahead. The provided URL has no crawlable links.");
                } else {
                    throw new Error(errorMessage || 'Failed to fetch sitemap.');
                }
            }
        } catch (err) {
            console.error('Error fetching sitemap:', err);
            setError(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleMapSelected = async () => {
        if (!selectedPage) return;
        
        const previousPages = [...pages]; // Keep a copy of the current pages
        setUrl(selectedPage);
        setIsLoading(true);
        setError('');
        setPages([]);

        try {
            const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/tavily-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: selectedPage }),
            });
            const data = await response.json();

            if (response.ok && data.status === 'success' && data.data?.results?.length > 0) {
                setPages(data.data.results);
                setSelectedPage('');
            } else {
                const errorMessage = data.message || '';
                if (errorMessage.includes('No URLs found') || data.data?.results?.length === 0) {
                    setError("No links found on the selected page. Returning to the previous list.");
                    setPages(previousPages); // Restore previous pages
                } else {
                    throw new Error(errorMessage || 'Could not map the website.');
                }
            }
        } catch (err) {
            console.error('Error fetching sitemap:', err);
            setError(`Error: ${err.message}`);
            setPages(previousPages); // Also restore on generic error
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPage = (pageUrl) => {
        setSelectedPage(pageUrl);
    };

    const handleGenerateNotes = async () => {
        if (!selectedPage) return;
        setIsCreating(true);
        setError('');
        try {
            const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/generate-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: selectedPage }),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                toast.success(`Notes generated successfully for '${result.data.notes.title}'.`);
                onNotesGenerated(result.data.notes, selectedPage);
                onClose();
            } else {
                const errorDetail = result.detail?.error || 'Failed to generate notes.';
                throw new Error(errorDetail);
            }
        } catch (err) {
            console.error('Error generating notes:', err);
            setError(`An error occurred while generating notes: ${err.message}`);
            toast.error('Failed to generate notes.');
        } finally {
            setIsCreating(false);
        }
    };
    
    const urlToTitle = (pageUrl) => {
        try {
            const path = new URL(pageUrl).pathname;
            if (path === '/') return 'Home';
            const parts = path.split('/').filter(Boolean);
            const lastPart = parts[parts.length - 1] || parts[parts.length - 2];
            return lastPart
                .replace(/[_-]/g, ' ')
                .replace(/\.html?$/, '')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        } catch (e) {
            return pageUrl;
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setUrl('');
            setPages([]);
            setSelectedPage('');
            setIsLoading(false);
            setIsCreating(false);
            setError('');
        }
    }, [isOpen]);

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ transition: 'opacity 0.3s ease-in-out'}}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-2xl w-full flex flex-col h-auto max-h-[85vh] border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import from Website</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl z-10" aria-label="Close"> × </button>
                </div>
                <form onSubmit={handleFetchPages} className="mb-4">
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"
                            required
                        />
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center w-40">
                            {isLoading ? 'Fetching...' : 'Fetch Pages'}
                        </button>
                    </div>
                </form>

                <div className="flex-grow overflow-y-auto pr-2 border-t border-b border-slate-200 dark:border-slate-700 py-4">
                    {error && <div className="text-center text-red-500 p-2">{error}</div>}
                    {isLoading && !pages.length && <div className="text-center text-gray-500 p-4">Fetching pages...</div>}
                    {!isLoading && !pages.length && !error && <div className="text-center text-gray-500 p-4">Enter a URL to get started.</div>}
                    {pages.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Select a page to generate a chapter, or map it for more pages.</p>
                            {pages.map((page, index) => (
                                <label key={index} className={`flex items-center p-2 rounded-lg cursor-pointer ${selectedPage === page ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <input
                                        type="radio"
                                        name="pageSelection"
                                        checked={selectedPage === page}
                                        onChange={() => handleSelectPage(page)}
                                        className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={page}>{urlToTitle(page)}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 dark:text-gray-300 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                    <button onClick={handleMapSelected} disabled={!selectedPage || isLoading || isCreating} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        Map Selected
                    </button>
                    <button onClick={handleGenerateNotes} disabled={!selectedPage || isCreating || isLoading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isCreating ? 'Generating...' : 'Generate Notes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotesModal = ({ isOpen, onClose, notes, onSave }) => {
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen || !notes) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave();
            // The onSave function will handle toast messages and closing
        } catch (error) {
            console.error('Failed to save from modal:', error);
            // Error toast is likely handled in the onSave implementation
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-2xl w-full flex flex-col h-auto max-h-[85vh] border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-4">{notes.title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl z-10 flex-shrink-0" aria-label="Close"> × </button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="mb-6">
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Summary</h4>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{notes.detailed_summary}</p>
                    </div>
                     <div>
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200 mb-2">Key Points</h4>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                            {notes.key_points.map((point, index) => (
                                <li key={index}>{point}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                 <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-200 dark:text-gray-300 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
                    {onSave && (
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
                        >
                            {isSaving ? 'Saving...' : 'Save Notes'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function UserSpacePage({ params }) {
  const router = useRouter();
  const spaceId = React.use(params).id;
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('latest-updates');
  const [showChaptersList, setShowChaptersList] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [audiobooks, setAudiobooks] = useState([]);
  const [storyboards, setStoryboards] = useState([]);
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [selectedFlashcardSet, setSelectedFlashcardSet] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizUserAnswers, setQuizUserAnswers] = useState([]);
  const [quizScore, setQuizScore] = useState(null);
  const [showAudiobookModal, setShowAudiobookModal] = useState(false);
  const [selectedAudiobook, setSelectedAudiobook] = useState(null);
  const [showStoryboardModal, setShowStoryboardModal] = useState(false);
  const [selectedStoryboard, setSelectedStoryboard] = useState(null);
  const [currentStoryboardSceneIndex, setCurrentStoryboardSceneIndex] = useState(0);
  const [isSearchWidgetOpen, setIsSearchWidgetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const chatContainerRef = useRef(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState(null);
  const [notesSourceUrl, setNotesSourceUrl] = useState('');
  const [webNotes, setWebNotes] = useState([]);
  const [selectedWebNote, setSelectedWebNote] = useState(null);
  const [showWebNoteModal, setShowWebNoteModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef(null);
  const prevSidebarWidth = useRef(260);
  const [searchingCard, setSearchingCard] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showChatCardModal, setShowChatCardModal] = useState(false);
  const [selectedChatCard, setSelectedChatCard] = useState(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isSearching]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await account.get();
        setCurrentUser(user);
        const [spaceData, chaptersRes, webNotesRes] = await Promise.all([
            teams.get(spaceId),
            databases.listDocuments(DATABASE_ID, CHAPTERS_COLLECTION_ID, [Query.equal('spaceId', spaceId)]),
            databases.listDocuments(DATABASE_ID, WEB_NOTES_COLLECTION_ID, [Query.equal('userId', user.$id)])
        ]);
        
        setSpace(spaceData);
        setChapters(chaptersRes.documents);
        setWebNotes(webNotesRes.documents);
        
        if (chaptersRes.documents.length > 0) {
          await handleChapterClick(chaptersRes.documents[0]);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load space data: ' + err.message);
        setLoading(false);
      }
    };
    fetchData();
  }, [spaceId]);


  const handleChapterClick = async (chapter) => {
    setSelectedChapter(chapter);
    try {
      const [flashRes, sumRes, quizRes, audioRes, storyRes] = await Promise.all([
        databases.listDocuments(
          DATABASE_ID,
          FLASHCARDS_COLLECTION_ID,
          [Query.equal('chapterId', chapter.$id)]
        ),
        databases.listDocuments(
          DATABASE_ID,
          "summaries",
          [Query.equal('chapterId', chapter.$id), Query.equal('spaceId', spaceId)]
        ),
        databases.listDocuments(
          DATABASE_ID,
          'quizzes',
          [Query.equal('chapterId', chapter.$id), Query.equal('spaceId', spaceId)]
        ),
        databases.listDocuments(
          DATABASE_ID,
          AUDIOBOOKS_COLLECTION_ID,
          [Query.equal('chapterId', chapter.$id)]
        ),
        databases.listDocuments(
          DATABASE_ID,
          STORYBOARDS_COLLECTION_ID,
          [Query.equal('chapterId', chapter.$id)]
        ),
      ]);
      setFlashcards(flashRes.documents.map(doc => ({ ...doc, cards: JSON.parse(doc.cards) })));
      setSummaries(sumRes.documents);
      setQuizzes(quizRes.documents.map(doc => ({ ...doc, questions: JSON.parse(doc.questions) })));
      setAudiobooks(audioRes.documents);
      setStoryboards(storyRes.documents.map(doc => ({ ...doc, boards: JSON.parse(doc.boards) })));
    } catch (err) {
      setError('Failed to load chapter content: ' + err.message);
    }
  };

  const handleWebSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const newQuery = searchQuery;
    setChatHistory(prev => [...prev, { type: 'user', text: newQuery }]);
    setSearchQuery('');
    setIsSearching(true);
    setSearchError('');

    try {
      const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/tavily-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: newQuery }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      if (data.status === 'success' && data.data) {
        setChatHistory(prev => [...prev, { type: 'bot', data: data.data }]);
      } else {
        throw new Error(data.message || 'Failed to get search results.');
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { type: 'error', text: err.message }]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchChapters = async () => {
    try {
      const chaptersRes = await databases.listDocuments(
        DATABASE_ID,
        CHAPTERS_COLLECTION_ID,
        [Query.equal('spaceId', spaceId)]
      );
      setChapters(chaptersRes.documents);
      return chaptersRes.documents;
    } catch (err) {
      console.error('Failed to fetch chapters', err);
      setError('Failed to fetch chapters: ' + err.message);
      return [];
    }
  };

  const handleNotesGenerated = (notes, url) => {
      setGeneratedNotes(notes);
      setNotesSourceUrl(url);
      setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!generatedNotes) return;
    
    try {
        const user = await account.get();
        const userId = user.$id;
        
        await databases.createDocument(
            DATABASE_ID,
            WEB_NOTES_COLLECTION_ID,
            ID.unique(),
            {
                userId: userId,
                title: generatedNotes.title,
                detailed_summary: generatedNotes.detailed_summary,
                key_points: generatedNotes.key_points,
                sourceUrl: notesSourceUrl
            },
            // Set document-level permissions
            [
              `read("user:${userId}")`,
              `update("user:${userId}")`,
              `delete("user:${userId}")`
            ]
        );
        
        toast.success('Notes saved successfully!');
        setShowNotesModal(false); // Close modal on success
    } catch (error) {
        console.error('Failed to save notes:', error);
        toast.error(`Failed to save notes: ${error.message}`);
        // Re-throw to be caught in the modal's handler if needed
        throw error;
    }
  };

  const handleSidebarDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (moveEvent) => {
      let newWidth = startWidth + (moveEvent.clientX - startX);
      newWidth = Math.max(56, Math.min(400, newWidth));
      setSidebarWidth(newWidth);
      prevSidebarWidth.current = newWidth;
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCollapse = () => {
    if (!sidebarCollapsed) {
      prevSidebarWidth.current = sidebarWidth;
      setSidebarWidth(56);
      setSidebarCollapsed(true);
    } else {
      setSidebarWidth(prevSidebarWidth.current || 260);
      setSidebarCollapsed(false);
    }
  };

  const hasAnyContent =
    flashcards.length > 0 ||
    summaries.length > 0 ||
    quizzes.length > 0 ||
    audiobooks.length > 0 ||
    storyboards.length > 0;

  const handleCardSearch = async (card) => {
    setSearchingCard(card);
    setSearchResult(null);
    setSearchError('');
    setSearchLoading(true);
    try {
      const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/tavily-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: card.note })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success' && data.data) {
        setSearchResult(data.data);
      } else {
        setSearchError(data.message || 'No result');
      }
    } catch (err) {
      setSearchError('Failed to search: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <Link href="/dashboard" className="mt-6 inline-block text-indigo-600 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900">
      {/* Navbar */}
      <div className="sticky top-0 left-0 right-0 z-50 bg-black text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center h-12 gap-2">
            <Link href="/dashboard" className="flex items-center text-white hover:text-gray-300 mr-2" aria-label="Back to My Spaces">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-base font-semibold text-white truncate max-w-xs">{space?.name || 'Space'}</span>
            {space?.description && (
              <span className="inline-block bg-gray-800 text-white text-xs font-normal px-2 py-0.5 rounded max-w-xs truncate border border-transparent ml-2">
                {space.description}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Flexible layout: sidebar + main content */}
      <div className="flex flex-1 w-full">
        {/* Sidebar: fixed height, independently scrollable */}
        <aside
          ref={sidebarRef}
          style={{ width: sidebarWidth, minWidth: 56, maxWidth: 400, transition: 'width 0.2s' }}
          className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 pt-8 fixed top-0 left-0 z-40"
        >
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              onClick={handleCollapse}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              )}
            </button>
          </div>
          <div className="flex flex-row gap-4">
          <Tabs
              aria-label="Chapters Toggle"
            isVertical
              className="w-full mb-0 mr-4 ml-2"
              selectedKey={
                activeTab === 'latest-updates' ? 'latest-updates' :
                (showChaptersList ? 'chapters' : (activeTab === 'webnotes' ? 'webnotes' : ''))
              }
              onSelectionChange={key => {
                if (key === 'latest-updates') {
                  setShowChaptersList(false);
                  setActiveTab('latest-updates');
                } else if (key === 'chapters') {
                  setShowChaptersList(v => !v);
                  if (!showChaptersList) setActiveTab('flashcards');
                } else if (key === 'webnotes') {
                  setShowChaptersList(false);
                  setActiveTab('webnotes');
                }
              }}
            >
              <Tab key="latest-updates" title={<span className="font-bold text-xl py-6 px-8 flex w-full justify-start items-center">🆕 Updates</span>} className="justify-start w-full" />
              <Tab key="chapters" title={<span className="truncate font-bold text-xl py-6 px-8 flex w-full justify-start items-center">📚 Chapters</span>} className="justify-start w-full" />
              <Tab key="webnotes" title={<span className="font-bold text-xl py-6 px-8 flex w-full justify-start items-center">📝 Web Notes</span>} className="justify-start w-full" />
            </Tabs>
           
          </div>
        </aside>
        {/* Main Content Area: flexible, scrolls independently */}
        <main
          style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.2s' }}
          className="flex-1 px-4 sm:px-8 py-8 overflow-y-auto"
        >
          {showChaptersList && chapters.length > 0 && (
            <Tabs
              aria-label="Chapter List"
              isVertical={false}
              className="w-full mb-2"
            selectedKey={selectedChapter?.$id || (chapters[0]?.$id || '')}
            onSelectionChange={key => {
              const chapter = chapters.find(c => c.$id === key);
              if (chapter) handleChapterClick(chapter);
            }}
          >
            {chapters.map((chapter) => (
                <Tab key={chapter.$id} title={<span className="truncate text-base py-2 px-4 font-medium">{chapter.name}</span>} />
            ))}
          </Tabs>
          )}
          {showChaptersList && !hasAnyContent && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-lg">
              No content in this chapter.
            </div>
          )}
          {showChaptersList && hasAnyContent && (
            <>
          <Tabs
            aria-label="Content Type"
                isVertical={false}
                className="w-full mb-8"
            selectedKey={activeTab}
            onSelectionChange={setActiveTab}
          >
                {flashcards.length > 0 && <Tab key="flashcards" title={<span className="font-semibold text-lg py-4 px-6">Flashcards</span>} />}
                {summaries.length > 0 && <Tab key="summaries" title={<span className="font-semibold text-lg py-4 px-6">Summaries</span>} />}
                {quizzes.length > 0 && <Tab key="quizzes" title={<span className="font-semibold text-lg py-4 px-6">Quizzes</span>} />}
                {audiobooks.length > 0 && <Tab key="audiobooks" title={<span className="font-semibold text-lg py-4 px-6">Audiobooks</span>} />}
                {storyboards.length > 0 && <Tab key="storyboards" title={<span className="font-semibold text-lg py-4 px-6">Storyboards</span>} />}
          </Tabs>
              {activeTab === 'flashcards' && flashcards.length > 0 && (
            <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardBody>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Flashcards</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {flashcards.map((flashcardSet) => (
                      <button
                        key={flashcardSet.$id}
                        onClick={() => {
                          setSelectedFlashcardSet(flashcardSet);
                          setCurrentCardIndex(0);
                          setIsFlipped(false);
                          setShowFlashcardModal(true);
                        }}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{flashcardSet.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{flashcardSet.cards.length} cards</p>
                      </button>
                    ))}
                  </div>
              </CardBody>
            </Card>
          )}
              {activeTab === 'summaries' && summaries.length > 0 && (
            <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardBody>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Summaries</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {summaries.map((summary) => (
                      <button
                        key={summary.$id}
                        onClick={() => {
                          setSelectedSummary(summary);
                          setShowSummaryModal(true);
                        }}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {summary.summary?.split(' ').slice(0, 10).join(' ')}{summary.summary?.split(' ').length > 10 ? '...' : ''}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{new Date(summary.createdAt).toLocaleDateString()}</p>
                        <span className="text-xs text-indigo-500 dark:text-indigo-300 underline">View Summary</span>
                      </button>
                    ))}
                  </div>
              </CardBody>
            </Card>
          )}
              {activeTab === 'quizzes' && quizzes.length > 0 && (
            <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardBody>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Quizzes</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quizzes.map((quiz) => (
                      <button
                        key={quiz.$id}
                        onClick={() => {
                          setSelectedQuiz(quiz);
                          setQuizQuestionIndex(0);
                          setQuizUserAnswers([]);
                          setQuizScore(null);
                          setShowQuizModal(true);
                        }}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{quiz.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{quiz.questions.length} questions</p>
                        <span className="text-xs text-indigo-500 dark:text-indigo-300 underline">Take Quiz</span>
                      </button>
                    ))}
                  </div>
              </CardBody>
            </Card>
          )}
              {activeTab === 'audiobooks' && audiobooks.length > 0 && (
            <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardBody>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Audiobooks</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {audiobooks.map((ab) => (
                      <button
                        key={ab.$id}
                        onClick={() => {
                          setSelectedAudiobook(ab);
                          setShowAudiobookModal(true);
                        }}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{ab.title || 'Untitled Audiobook'}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{ab.createdAt ? new Date(ab.createdAt).toLocaleDateString() : ''}</p>
                        <span className="text-xs text-indigo-500 dark:text-indigo-300 underline">Listen</span>
                        </button>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
              {activeTab === 'storyboards' && storyboards.length > 0 && (
                <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <CardBody>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Storyboards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {storyboards.map((storyboard) => (
                        <button
                          key={storyboard.$id}
                          onClick={() => {
                            setSelectedStoryboard(storyboard);
                            setCurrentStoryboardSceneIndex(0);
                            setShowStoryboardModal(true);
                          }}
                          className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                        >
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{storyboard.title}</h3>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{storyboard.boards.length} boards</p>
                          <span className="text-xs text-indigo-500 dark:text-indigo-300 underline">View Storyboard</span>
                        </button>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
            </>
          )}
          {activeTab === 'webnotes' && (
            <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardBody>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Web Notes</h2>
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                    onClick={() => setShowImportModal(true)}
                  >
                    <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' /></svg>
                    New Web Note
                  </button>
                </div>
                {webNotes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {webNotes.map((note) => (
                      <button
                        key={note.$id}
                        onClick={() => {
                          setSelectedWebNote(note);
                          setShowWebNoteModal(true);
                        }}
                        className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-[1.02] focus:scale-[1.02] transition-transform duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-700"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">{note.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                          Saved on {new Date(note.$createdAt).toLocaleDateString()} from <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-400" onClick={(e) => e.stopPropagation()}>{new URL(note.sourceUrl).hostname}</a>
                        </p>
                        <span className="text-xs text-indigo-500 dark:text-indigo-300 underline">View Note</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 dark:text-gray-500">You haven&apos;t saved any web notes yet. Generate some from the &apos;New Web Note&apos; button!</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </main>
      </div>
      {/* Flashcard Modal */}
      {showFlashcardModal && selectedFlashcardSet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-md w-full relative border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowFlashcardModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-center mb-6 text-gray-900 dark:text-white">{selectedFlashcardSet.title}</h3>
            {selectedFlashcardSet.cards.length > 0 && (
              <div className="flex flex-col items-center">
                {/* Minimal Rotatable Flashcard */}
                <div
                  className="w-72 h-48 mb-6 relative"
                  style={{ perspective: '1000px', cursor: 'pointer' }}
                  onClick={() => setIsFlipped((f) => !f)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setIsFlipped((f) => !f);
                    }
                  }}
                >
                  <div
                    className="absolute w-full h-full"
                    style={{
                      transition: 'transform 0.5s',
                      transformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front (Question) */}
                    <div
                      className="absolute w-full h-full flex items-center justify-center rounded-xl shadow border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-semibold"
                      style={{
                        backfaceVisibility: 'hidden',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                      }}
                    >
                      <span className="text-gray-900 dark:text-white text-center px-4">{selectedFlashcardSet.cards[currentCardIndex].question}</span>
                    </div>
                    {/* Back (Answer) */}
                    <div
                      className="absolute w-full h-full flex items-center justify-center rounded-xl shadow border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-semibold"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                      }}
                    >
                      <span className="text-gray-900 dark:text-white text-center px-4">{selectedFlashcardSet.cards[currentCardIndex].answer}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full mt-4">
                  <button
                    onClick={() => {
                      setCurrentCardIndex((i) => (i > 0 ? i - 1 : selectedFlashcardSet.cards.length - 1));
                      setIsFlipped(false);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    Previous
                  </button>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    {currentCardIndex + 1} / {selectedFlashcardSet.cards.length}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentCardIndex((i) => (i < selectedFlashcardSet.cards.length - 1 ? i + 1 : 0));
                      setIsFlipped(false);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    Next
                  </button>
                </div>
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">Click the card to flip</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Summary Modal */}
      {showSummaryModal && selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-lg w-full relative border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowSummaryModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-white">
              {selectedSummary.summary?.split(' ').slice(0, 10).join(' ')}{selectedSummary.summary?.split(' ').length > 10 ? '...' : ''}
            </h3>
            <div className="mb-2 text-xs text-gray-400 dark:text-gray-500 text-center">
              {new Date(selectedSummary.createdAt).toLocaleDateString()}
            </div>
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded text-gray-700 dark:text-gray-200 text-sm max-h-60 overflow-y-auto">
              {selectedSummary.summary}
            </div>
            <div className="flex justify-center">
              <a
                href={selectedSummary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 dark:text-indigo-300 underline hover:text-indigo-700 dark:hover:text-indigo-200"
              >
                Source URL
              </a>
            </div>
          </div>
        </div>
      )}
      {/* Quiz Modal */}
      {showQuizModal && selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-lg w-full relative border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowQuizModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-white">{selectedQuiz.title}</h3>
            {quizScore === null ? (
              <>
                <div className="mb-4 text-xs text-gray-400 dark:text-gray-500 text-center">
                  Question {quizQuestionIndex + 1} of {selectedQuiz.questions.length}
                </div>
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded text-gray-900 dark:text-gray-200 text-base font-medium">
                  {selectedQuiz.questions[quizQuestionIndex].question}
                </div>
                <div className="space-y-3 mb-6">
                  {selectedQuiz.questions[quizQuestionIndex].options.map((option, idx) => (
                    <label key={idx} className={`block px-4 py-2 rounded-lg border cursor-pointer transition-all text-gray-700 dark:text-gray-200 ${quizUserAnswers[quizQuestionIndex] === option ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      <input
                        type="radio"
                        name={`quiz-option-${quizQuestionIndex}`}
                        value={option}
                        checked={quizUserAnswers[quizQuestionIndex] === option}
                        onChange={() => {
                          const newAnswers = [...quizUserAnswers];
                          newAnswers[quizQuestionIndex] = option;
                          setQuizUserAnswers(newAnswers);
                        }}
                        className="mr-2 accent-indigo-500"
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      if (quizQuestionIndex > 0) setQuizQuestionIndex(quizQuestionIndex - 1);
                    }}
                    disabled={quizQuestionIndex === 0}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {quizQuestionIndex < selectedQuiz.questions.length - 1 ? (
                    <button
                      onClick={() => {
                        if (quizUserAnswers[quizQuestionIndex]) setQuizQuestionIndex(quizQuestionIndex + 1);
                      }}
                      disabled={!quizUserAnswers[quizQuestionIndex]}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // Calculate score
                        let score = 0;
                        selectedQuiz.questions.forEach((q, i) => {
                          if (quizUserAnswers[i] === q.correct_answer) score++;
                        });
                        setQuizScore(score);
                      }}
                      disabled={quizUserAnswers.length !== selectedQuiz.questions.length || quizUserAnswers.includes(undefined)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">Score: {quizScore} / {selectedQuiz.questions.length}</div>
                <div className="mb-6 text-gray-700 dark:text-gray-200 text-center">Well done! You can close this quiz or try again.</div>
                <button
                  onClick={() => {
                    setQuizScore(null);
                    setQuizUserAnswers([]);
                    setQuizQuestionIndex(0);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  Retake Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Audiobook Modal */}
      {showAudiobookModal && selectedAudiobook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-lg w-full relative border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowAudiobookModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-white">{selectedAudiobook.title || 'Untitled Audiobook'}</h3>
            <div className="mb-2 text-xs text-gray-400 dark:text-gray-500 text-center">
              {selectedAudiobook.createdAt ? new Date(selectedAudiobook.createdAt).toLocaleDateString() : ''}
            </div>
            {selectedAudiobook.fileUrl && (
              <audio controls className="w-full mb-4">
                <source src={selectedAudiobook.fileUrl} type="audio/mpeg" />
                <track kind="captions" src="" label="No captions" default />
                Your browser does not support the audio element.
              </audio>
            )}
            {selectedAudiobook.script && (
              <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded text-gray-700 dark:text-gray-200 text-sm max-h-40 overflow-y-auto">
                {selectedAudiobook.script}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Storyboard Modal */}
      {showStoryboardModal && selectedStoryboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 max-w-4xl w-full relative border border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowStoryboardModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl z-10"
              aria-label="Close"
            >
              ×
            </button>
            
            <h3 className="text-xl font-bold text-center mb-4 text-gray-900 dark:text-white">{selectedStoryboard.title}</h3>

            {selectedStoryboard.boards.length > 0 && (
              <>
                <div className="flex flex-col items-center">
                  <div className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden shadow-md mb-4 md:flex">
                    <div className="md:w-1/2">
                      <img 
                        src={selectedStoryboard.boards[currentStoryboardSceneIndex].image_url} 
                        alt={`Scene ${selectedStoryboard.boards[currentStoryboardSceneIndex].scene_number}`} 
                        className="w-full h-64 md:h-96 object-cover" 
                      />
                    </div>
                    <div className="md:w-1/2 p-6 flex flex-col justify-center">
                       <h3 className="font-bold text-2xl text-gray-800 dark:text-gray-200 mb-4">Scene {selectedStoryboard.boards[currentStoryboardSceneIndex].scene_number}</h3>
                       <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">{selectedStoryboard.boards[currentStoryboardSceneIndex].supporting_text}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full max-w-lg mt-4">
                    <button
                      onClick={() => {
                        setCurrentStoryboardSceneIndex((i) => (i > 0 ? i - 1 : selectedStoryboard.boards.length - 1));
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Previous
                    </button>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      {currentStoryboardSceneIndex + 1} / {selectedStoryboard.boards.length}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentStoryboardSceneIndex((i) => (i < selectedStoryboard.boards.length - 1 ? i + 1 : 0));
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Web Search Floating Button */}
      <button
        onClick={() => setIsSearchWidgetOpen(!isSearchWidgetOpen)}
        className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-50"
        aria-label="Search the Web"
      >
        {isSearchWidgetOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>

      {/* Import from URL Modal - now correctly implemented */}
      {showImportModal && (
        <ImportWebsiteModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onNotesGenerated={handleNotesGenerated}
        />
      )}

      {/* Notes Display Modal */}
      <NotesModal 
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        notes={generatedNotes}
        onSave={handleSaveNotes}
      />

      <NotesModal 
        isOpen={showWebNoteModal}
        onClose={() => setShowWebNoteModal(false)}
        notes={selectedWebNote}
      />

      {/* Web Search Widget */}
      <div
        className={`fixed bottom-24 right-8 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl z-40 transform transition-all duration-300 ease-in-out ${isSearchWidgetOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
      >
        <div className="p-4 h-[calc(100vh-10rem)] flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Search the Web</h3>
            <button
              onClick={() => setIsSearchWidgetOpen(false)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          
          <div ref={chatContainerRef} className="flex-grow overflow-y-auto pr-2 space-y-4">
            {chatHistory.length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <p>Ask a question to get started.</p>
              </div>
            ) : (
              chatHistory.map((item, index) => {
                if (item.type === 'user') {
                  return (
                    <div key={index} className="flex justify-end">
                      <div className="bg-indigo-600 text-white p-3 rounded-lg max-w-sm">
                        {item.text}
                      </div>
                    </div>
                  );
                }
                if (item.type === 'bot') {
                  return (
                    <div key={index} className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg max-w-sm">
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{item.data.answer}</p>
                        {item.data.results && item.data.results.length > 0 && (
                          <div className="mt-3">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm">Sources:</h4>
                            <div className="space-y-2">
                              {item.data.results.map((result, rIndex) => (
                                <a
                                  key={rIndex}
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  <span className="truncate">{result.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                if (item.type === 'error') {
                   return (
                     <div key={index} className="flex justify-start">
                       <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg max-w-sm">
                         {item.text}
                       </div>
                     </div>
                   );
                }
                return null;
              })
            )}

            {isSearching && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500"></div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Searching...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleWebSearch} className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask anything..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white"
                required
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center w-20"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      {searchingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Web Search</h3>
              <button onClick={() => setSearchingCard(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl z-10" aria-label="Close">×</button>
            </div>
            <div className="mb-4 text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Query:</span> {searchingCard?.note}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {searchLoading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
                  <span className="text-yellow-700 font-medium">Searching...</span>
                </div>
              )}
              {!searchLoading && searchError && (
                <div className="text-center text-red-500 py-4">{searchError}</div>
              )}
              {!searchLoading && searchResult && (
                <div className="space-y-4">
                  <div className="text-base text-gray-900 dark:text-white font-medium whitespace-pre-line">{searchResult.answer}</div>
                  {searchResult.sources && searchResult.sources.length > 0 && (
                    <div className="mt-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Sources:</span>
                      <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-400">
                        {searchResult.sources.map((src, i) => (
                          <li key={i}><a href={src.url} target="_blank" rel="noopener noreferrer" className="underline">{src.title || src.url}</a></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Chat Card Modal */}
      {showChatCardModal && selectedChatCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-100 dark:border-slate-800 h-[400px] max-h-[60vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Insight Card</h3>
              <button onClick={() => setShowChatCardModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl z-10" aria-label="Close">×</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="mb-4">
                <div className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Prompt:</div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-gray-900 dark:text-gray-100 whitespace-pre-line">{selectedChatCard.prompt}</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700 dark:text-gray-200 mb-2">AI Response:</div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded text-indigo-900 dark:text-indigo-100 whitespace-pre-line">{selectedChatCard.response}</div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowChatCardModal(false)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 