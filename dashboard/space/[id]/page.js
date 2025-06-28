'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Client, Account, Teams, Databases, Query, ID, Storage } from 'appwrite';
import { use } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { Tabs, Tab, Card, CardBody } from "@heroui/react";

// Initialize Appwrite client
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const account = new Account(client);
const teams = new Teams(client);
const databases = new Databases(client);
const storage = new Storage(client);

// Database and Collection IDs
const DATABASE_ID = 'learning_spaces';
const CHAPTERS_COLLECTION_ID = 'chapters';
const FLASHCARDS_COLLECTION_ID = 'flashcards';
const QUIZZES_COLLECTION_ID = 'quizzes';
const AUDIOBOOKS_COLLECTION_ID = 'audiobooks';
const STORYBOARDS_COLLECTION_ID = 'storyboards';
const AUDIOBOOKS_BUCKET_ID = 'audiobooks'; // Make sure this matches your Appwrite bucket ID

export default function SpaceDashboard({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const spaceId = unwrappedParams.id;
  const [user, setUser] = useState(null);
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('flashcards');
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [showCreateChapterModal, setShowCreateChapterModal] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterDescription, setNewChapterDescription] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [showCreateFlashcardModal, setShowCreateFlashcardModal] = useState(false);
  const [newFlashcard, setNewFlashcard] = useState({ question: '', answer: '' });
  const [showEditChapterModal, setShowEditChapterModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [editedChapter, setEditedChapter] = useState({ name: '', description: '' });
  const [urlInput, setUrlInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFlashcards, setGeneratedFlashcards] = useState([]);
  const [showGeneratedFlashcardsModal, setShowGeneratedFlashcardsModal] = useState(false);
  const [selectedFlashcard, setSelectedFlashcard] = useState(null);
  const [showEditFlashcardModal, setShowEditFlashcardModal] = useState(false);
  const [selectedFlashcardSet, setSelectedFlashcardSet] = useState(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [showGenerateSummaryModal, setShowGenerateSummaryModal] = useState(false);
  const [summaryUrlInput, setSummaryUrlInput] = useState("");
  const [summaryResult, setSummaryResult] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summarySaveLoading, setSummarySaveLoading] = useState(false);
  const [summarySaveError, setSummarySaveError] = useState("");
  const [summarySaveSuccess, setSummarySaveSuccess] = useState(false);
  const [summaries, setSummaries] = useState([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizInput, setQuizInput] = useState('');
  const [quizInputType, setQuizInputType] = useState('text'); // 'text' or 'url'
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  // Add new state variables
  const [quizDifficulty, setQuizDifficulty] = useState('easy');
  const [questionCount, setQuestionCount] = useState(5);
  // Add new state for quiz preview modal
  const [showQuizPreviewModal, setShowQuizPreviewModal] = useState(false);
  // Add quizzes state after other state variables
  const [quizzes, setQuizzes] = useState([]);
  // Add audiobook state variables after other state variables
  const [showAudiobookModal, setShowAudiobookModal] = useState(false);
  const [audiobookInput, setAudiobookInput] = useState('');
  const [audiobookInputType, setAudiobookInputType] = useState('topic'); // 'topic' or 'url'
  const [audiobookStoryType, setAudiobookStoryType] = useState('educational');
  const [audiobookDuration, setAudiobookDuration] = useState(30); // default to 30 seconds
  const [audiobookVoice, setAudiobookVoice] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [isGeneratingAudiobook, setIsGeneratingAudiobook] = useState(false);
  const [generatedAudiobook, setGeneratedAudiobook] = useState(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");
  const [generatedAudioScript, setGeneratedAudioScript] = useState("");
  const [isSavingAudiobook, setIsSavingAudiobook] = useState(false);
  const [audiobooks, setAudiobooks] = useState([]);
  const [showStoryboardModal, setShowStoryboardModal] = useState(false);
  const [storyboardPayload, setStoryboardPayload] = useState({
    description: "A magical forest with glowing mushrooms",
    image_type: "Entertainment",
    number_of_boards: 3,
    art_style: "Studio Ghibli style"
  });
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [generatedStoryboards, setGeneratedStoryboards] = useState([]);
  const [showStoryboardResultModal, setShowStoryboardResultModal] = useState(false);
  const [storyboards, setStoryboards] = useState([]);
  const [isSavingStoryboard, setIsSavingStoryboard] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const userData = await account.get();
        setUser(userData);

        // Fetch space details
        const spaceData = await teams.get(spaceId);
        setSpace(spaceData);

        // Fetch chapters
        await fetchChapters(spaceId);

        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load space data: ' + err.message);
        setLoading(false);
      }
    };

    checkUser();
  }, [spaceId]);

  useEffect(() => {
    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 4px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
      }
    `;
    document.head.appendChild(style);

    // Cleanup function
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const fetchChapters = async (spaceId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        CHAPTERS_COLLECTION_ID,
        [
          Query.equal('spaceId', spaceId)
        ]
      );
      setChapters(response.documents);
    } catch (err) {
      console.error('Error fetching chapters:', err);
      setError('Failed to fetch chapters');
    }
  };

  const fetchFlashcards = async (chapterId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        FLASHCARDS_COLLECTION_ID,
        [
          Query.equal('chapterId', chapterId)
        ]
      );
      setFlashcards(response.documents);
    } catch (err) {
      console.error('Error fetching flashcards:', err);
      setError('Failed to fetch flashcards');
    }
  };

  const fetchSummaries = async (chapterId) => {
    if (!chapterId) {
      console.log('No chapterId provided to fetchSummaries');
      return;
    }
    
    console.log('Fetching summaries for chapterId:', chapterId);
    
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'summaries',
        [
          Query.equal('chapterId', chapterId),
          Query.equal('spaceId', spaceId),
          Query.orderDesc('createdAt')
        ]
      );
      console.log('Fetched summaries:', response.documents);
      setSummaries(response.documents);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      toast.error('Failed to load summaries');
    }
  };

  const fetchQuizzes = async (chapterId) => {
    if (!chapterId) {
      console.log('No chapterId provided to fetchQuizzes');
      return;
    }
    
    console.log('Fetching quizzes for chapterId:', chapterId);
    
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        'quizzes',
        [
          Query.equal('chapterId', chapterId),
          Query.equal('spaceId', spaceId),
          Query.orderDesc('createdAt')
        ]
      );
      console.log('Fetched quizzes:', response.documents);
      
      // Parse the questions JSON string for each quiz
      const parsedQuizzes = response.documents.map(doc => ({
        ...doc,
        questions: JSON.parse(doc.questions)
      }));
      
      setQuizzes(parsedQuizzes);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      toast.error('Failed to load quizzes');
    }
  };

  const fetchStoryboards = async (chapterId) => {
    if (!chapterId) return;
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        STORYBOARDS_COLLECTION_ID,
        [
          Query.equal('chapterId', chapterId),
          Query.orderDesc('createdAt')
        ]
      );
      const parsedStoryboards = response.documents.map(doc => ({
        ...doc,
        boards: JSON.parse(doc.boards)
      }));
      setStoryboards(parsedStoryboards);
    } catch (err) {
      if (err.code !== 404) {
        console.error('Error fetching storyboards:', err);
        toast.error('Failed to load storyboards');
      } else {
        setStoryboards([]);
      }
    }
  };

  const handleCreateChapter = async (e) => {
    e.preventDefault();
    try {
      await databases.createDocument(
        DATABASE_ID,
        CHAPTERS_COLLECTION_ID,
        ID.unique(),
        {
          name: newChapterName,
          description: newChapterDescription,
          spaceId: spaceId,
          createdAt: new Date().toISOString(),
          createdBy: user.$id
        }
      );
      setShowCreateChapterModal(false);
      setNewChapterName('');
      setNewChapterDescription('');
      await fetchChapters(spaceId);
    } catch (err) {
      console.error('Error creating chapter:', err);
      setError('Failed to create chapter');
    }
  };

  const handleGenerateFlashcards = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(''); // Clear any previous errors
    try {
      // First check if the API is accessible
      const apiUrl = 'https://prospace-4d2a452088b6.herokuapp.com/generate-flashcards';
      
      // Increase timeout to 90 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

      // Validate URL input
      if (!urlInput.trim()) {
        throw new Error('Please enter a valid URL');
      }

      // Ensure URL is properly formatted
      let formattedUrl = urlInput.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      console.log('Sending request to:', apiUrl);
      console.log('Request payload:', { url: formattedUrl });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify({
          url: formattedUrl
        })
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Error response:', errorData);
        if (response.status === 400) {
          throw new Error('Invalid URL format. Please enter a valid URL.');
        }
        throw new Error(errorData?.message || `Server error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);
      
      // Check if the response has the expected structure
      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response format from server');
      }

      // Handle the new response format
      if (responseData.status === 'error') {
        throw new Error(responseData.message || 'Server error');
      }

      if (responseData.status !== 'success' || !responseData.data?.flashcards) {
        throw new Error('Invalid response format from server');
      }

      const flashcards = responseData.data.flashcards;

      // Validate each flashcard has the required fields
      const validFlashcards = flashcards.filter(card => 
        card && 
        typeof card === 'object' && 
        typeof card.question === 'string' && 
        typeof card.answer === 'string'
      );

      if (validFlashcards.length === 0) {
        throw new Error('No valid flashcards found in the response');
      }

      setGeneratedFlashcards(validFlashcards);
      setShowToolsModal(false); // Close the tools modal
      setShowGeneratedFlashcardsModal(true); // Open the new modal
    } catch (err) {
      console.error('Error generating flashcards:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. The server is taking too long to respond. Please try again.');
      } else if (err.message.includes('Failed to fetch')) {
        setError('Could not connect to the API server. Please ensure it is running at http://127.0.0.1:5000 and CORS is enabled.');
      } else {
        setError(err.message || 'Failed to generate flashcards. Please try again.');
      }
      setGeneratedFlashcards([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedFlashcards = async () => {
    if (!selectedChapter || !generatedFlashcards.length) return;
    
    try {
      setError('');
      
      // Create a single document with the entire flashcard set
      await databases.createDocument(
        DATABASE_ID,
        FLASHCARDS_COLLECTION_ID,
        ID.unique(),
        {
          chapterId: selectedChapter.$id,
          title: `Flashcards for ${selectedChapter.name}`,
          cards: JSON.stringify(generatedFlashcards), // Convert array to string
          createdAt: new Date().toISOString(),
          createdBy: user.$id
        }
      );

      setGeneratedFlashcards([]);
      setShowGeneratedFlashcardsModal(false);
      setUrlInput('');
      // Refresh flashcards list
      loadFlashcards(selectedChapter.$id);
      toast.success('Flashcards saved successfully!');
    } catch (err) {
      console.error('Error saving flashcards:', err);
      setError('Failed to save flashcards. Please try again.');
    }
  };

  const loadFlashcards = async (chapterId) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        FLASHCARDS_COLLECTION_ID,
        [
          Query.equal('chapterId', chapterId),
          Query.orderDesc('createdAt')
        ]
      );
      
      // Parse the cards JSON string for each document
      const parsedFlashcards = response.documents.map(doc => ({
        ...doc,
        cards: JSON.parse(doc.cards)
      }));
      
      setFlashcards(parsedFlashcards);
    } catch (err) {
      console.error('Error loading flashcards:', err);
      toast.error('Failed to load flashcards');
    }
  };

  const handleChapterClick = async (chapter) => {
    setSelectedChapter(chapter);
    await fetchFlashcards(chapter.$id);
    await fetchSummaries(chapter.$id);
    await fetchQuizzes(chapter.$id);
    await fetchAudiobooks(chapter.$id);
    await fetchStoryboards(chapter.$id);
  };

  const handleEditChapter = async (e) => {
    e.preventDefault();
    try {
      await databases.updateDocument(
        DATABASE_ID,
        CHAPTERS_COLLECTION_ID,
        selectedChapter.$id,
        {
          name: editedChapter.name,
          description: editedChapter.description
        }
      );
      setShowEditChapterModal(false);
      await fetchChapters(spaceId);
      // Update selected chapter with new data
      const updatedChapter = { ...selectedChapter, ...editedChapter };
      setSelectedChapter(updatedChapter);
    } catch (err) {
      console.error('Error updating chapter:', err);
      setError('Failed to update chapter');
    }
  };

  const handleDeleteChapter = async () => {
    if (window.confirm('Are you sure you want to delete this chapter? This will also delete all associated flashcards.')) {
      try {
        // First delete all flashcards in this chapter
        const flashcards = await databases.listDocuments(
          DATABASE_ID,
          FLASHCARDS_COLLECTION_ID,
          [Query.equal('chapterId', selectedChapter.$id)]
        );
        
        for (const flashcard of flashcards.documents) {
          await databases.deleteDocument(
            DATABASE_ID,
            FLASHCARDS_COLLECTION_ID,
            flashcard.$id
          );
        }

        // Then delete the chapter
        await databases.deleteDocument(
          DATABASE_ID,
          CHAPTERS_COLLECTION_ID,
          selectedChapter.$id
        );
        
        setSelectedChapter(null);
        await fetchChapters(spaceId);
      } catch (err) {
        console.error('Error deleting chapter:', err);
        setError('Failed to delete chapter');
      }
    }
  };

  const handleCardClick = (flashcardSet, cardIndex) => {
    setSelectedFlashcardSet(flashcardSet);
    setSelectedCardIndex(cardIndex);
    setShowEditFlashcardModal(true);
  };

  const handleEditCard = (field, value) => {
    if (selectedFlashcardSet && selectedCardIndex !== null) {
      const cards = typeof selectedFlashcardSet.cards === 'string' 
        ? JSON.parse(selectedFlashcardSet.cards) 
        : selectedFlashcardSet.cards;
      
      const updatedCards = [...cards];
      updatedCards[selectedCardIndex] = {
        ...updatedCards[selectedCardIndex],
        [field]: value
      };

      // Update the flashcard set in the database
      databases.updateDocument(
        DATABASE_ID,
        FLASHCARDS_COLLECTION_ID,
        selectedFlashcardSet.$id,
        {
          cards: JSON.stringify(updatedCards)
        }
      ).then(() => {
        // Update local state
        const updatedFlashcards = flashcards.map(fs => 
          fs.$id === selectedFlashcardSet.$id 
            ? { ...fs, cards: JSON.stringify(updatedCards) }
            : fs
        );
        setFlashcards(updatedFlashcards);
      }).catch(err => {
        console.error('Error updating flashcard:', err);
        toast.error('Failed to update flashcard');
      });
    }
  };

  const handleDeleteFlashcard = (index) => {
    const updatedFlashcards = flashcards.filter((_, i) => i !== index);
    setFlashcards(updatedFlashcards);
    if (selectedFlashcard === index) {
      setShowEditFlashcardModal(false);
      setSelectedFlashcard(null);
    }
  };

  async function handleSaveSummary(summary) {
    if (!selectedChapter?.$id) {
      setSummarySaveError("Please select a chapter first");
      return;
    }

    setSummarySaveLoading(true);
    setSummarySaveError("");
    setSummarySaveSuccess(false);

    // Log the values we're about to save
    console.log('Saving summary with:', {
      chapterId: selectedChapter.$id,
      spaceId: spaceId,
      url: summaryUrlInput
    });

    try {
      const databases = new Databases(client);
      
      const summaryData = {
        summary: summary,
        url: summaryUrlInput,
        spaceId: spaceId,
        chapterId: selectedChapter.$id,
        userId: user.$id,
        createdAt: new Date().toISOString()
      };

      // Log the data we're sending to Appwrite
      console.log('Summary data to save:', summaryData);

      const result = await databases.createDocument(
        DATABASE_ID,
        'summaries',
        ID.unique(),
        summaryData
      );

      // Log the result from Appwrite
      console.log('Summary save result:', result);

      setSummarySaveSuccess(true);
      // Refresh summaries after saving
      await fetchSummaries(selectedChapter.$id);
      // Close the modal after successful save
      setTimeout(() => {
        setShowGenerateSummaryModal(false);
        setSummaryUrlInput("");
        setSummaryResult("");
        setSummaryError("");
        setSummarySaveSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving summary:', err);
      setSummarySaveError(err.message || "Failed to save summary.");
    } finally {
      setSummarySaveLoading(false);
    }
  }

  const handleDeleteSummary = async (summaryId) => {
    try {
      const databases = new Databases(client);
      await databases.deleteDocument(
        DATABASE_ID,
        'summaries',
        summaryId
      );
      // Refresh summaries after deletion
      await fetchSummaries(selectedChapter.$id);
      toast.success('Summary deleted successfully');
    } catch (err) {
      console.error('Error deleting summary:', err);
      toast.error('Failed to delete summary');
    }
  };

  const handleGenerateQuiz = async () => {
    try {
      setIsGeneratingQuiz(true);
      const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: quizInput,
          num_questions: questionCount,
          difficulty: quizDifficulty
        }),
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      // Parse the JSON response
      const data = JSON.parse(responseText);
      console.log('Parsed quiz data:', data);
      console.log('Data structure check:', {
        hasData: !!data.data,
        hasQuiz: !!data.data?.quiz,
        hasQuestions: !!data.data?.quiz?.questions,
        questionsLength: data.data?.quiz?.questions?.length,
        questionsType: typeof data.data?.quiz?.questions
      });

      // Check for the nested data structure
      if (!data.data || !data.data.quiz || !data.data.quiz.questions) {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid quiz data structure');
      }

      // Set the quiz data from the nested structure
      setGeneratedQuiz(data.data.quiz.questions);
      setShowQuizModal(false);
      setShowQuizPreviewModal(true);
      toast.success('Quiz generated successfully!');
    } catch (err) {
      console.error('Error generating quiz:', err);
      toast.error(err.message || 'Failed to generate quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSaveQuiz = async () => {
    try {
      if (!selectedChapter) {
        toast.error('Please select a chapter first');
        return;
      }

      const quizData = {
        title: "Generated Quiz",
        description: "Quiz generated from content",
        questions: JSON.stringify(generatedQuiz), // Store as JSON string like flashcards
        spaceId: spaceId,
        chapterId: selectedChapter.$id,
        createdBy: user.$id,
        createdAt: new Date().toISOString()
      };

      await databases.createDocument(
        DATABASE_ID,
        'quizzes',
        ID.unique(),
        quizData
      );

      toast.success('Quiz saved successfully!');
      setShowQuizPreviewModal(false);
      setGeneratedQuiz([]);
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error('Failed to save quiz');
    }
  };

  // Audiobook generation function
  const handleGenerateAudiobook = async () => {
    try {
      setIsGeneratingAudiobook(true);
      let durationLabel = audiobookDuration === 60 ? '1 minute' : `${audiobookDuration} seconds`;
      const payload = {
        topic: audiobookInput,
        style: audiobookStoryType.charAt(0).toUpperCase() + audiobookStoryType.slice(1),
        duration: durationLabel,
        voice_id: audiobookVoice
      };
      console.log('Audiobook payload:', payload);
      const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/audiobook-to-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log('Audiobook generation response:', data);
      if (data.status === 'success' && data.data && data.data.audio_url) {
        const backendBase = "http://127.0.0.1:5000";
        const audioUrl = data.data.audio_url.startsWith("/")
          ? backendBase + data.data.audio_url
          : data.data.audio_url;
        setGeneratedAudiobook(audioUrl); // for backward compatibility
        setGeneratedAudioUrl(audioUrl);
        setGeneratedAudioScript(data.data.script || "");
        setShowAudiobookModal(false);
        toast.success('Audiobook generated successfully!');
      } else {
        throw new Error(data.message || 'Failed to generate audiobook');
      }
    } catch (error) {
      console.error('Error generating audiobook:', error);
      toast.error('Failed to generate audiobook');
    } finally {
      setIsGeneratingAudiobook(false);
    }
  };

  async function handleSaveAudiobook() {
    if (!generatedAudioUrl || !selectedChapter) return;
    setIsSavingAudiobook(true);
    try {
      // Fetch the audio file as a blob
      const audioRes = await fetch(generatedAudioUrl);
      const audioBlob = await audioRes.blob();
      const fileName = `audiobook_${Date.now()}.mp3`;
      // Upload to Appwrite Storage
      const file = await storage.createFile(
        AUDIOBOOKS_BUCKET_ID,
        ID.unique(),
        new File([audioBlob], fileName, { type: 'audio/mpeg' })
      );
      console.log('File upload result:', file);
      console.log('File ID:', file.$id);
      // Try generating the file URL in multiple ways
      const fileViewObj = storage.getFileView(AUDIOBOOKS_BUCKET_ID, file.$id);
      const fileDownloadObj = storage.getFileDownload(AUDIOBOOKS_BUCKET_ID, file.$id);
      console.log('getFileView object:', fileViewObj);
      console.log('getFileDownload object:', fileDownloadObj);
      const fileUrlViewHref = fileViewObj?.href;
      const fileUrlViewString = fileViewObj?.toString();
      const fileUrlDownloadHref = fileDownloadObj?.href;
      const fileUrlDownloadString = fileDownloadObj?.toString();
      console.log('fileUrlViewHref:', fileUrlViewHref);
      console.log('fileUrlViewString:', fileUrlViewString);
      console.log('fileUrlDownloadHref:', fileUrlDownloadHref);
      console.log('fileUrlDownloadString:', fileUrlDownloadString);
      // Prefer fileUrlViewHref, fallback to fileUrlViewString, then download links
      const fileUrl = fileUrlViewHref || fileUrlViewString || fileUrlDownloadHref || fileUrlDownloadString;
      if (!fileUrl) throw new Error('Failed to generate file URL');
      // Save metadata in audiobooks collection
      await databases.createDocument(
        DATABASE_ID,
        AUDIOBOOKS_COLLECTION_ID,
        ID.unique(),
        {
          chapterId: selectedChapter.$id,
          spaceId: spaceId,
          userId: user.$id,
          fileId: file.$id,
          fileUrl, // This is now guaranteed to be present
          script: generatedAudioScript,
          title: audiobookInput,
          createdAt: new Date().toISOString(),
        }
      );
      toast.success('Audiobook saved to Appwrite!');
      setGeneratedAudioUrl("");
      setGeneratedAudioScript("");
    } catch (err) {
      console.error('Error saving audiobook:', err);
      toast.error('Failed to save audiobook.');
    } finally {
      setIsSavingAudiobook(false);
    }
  }

  async function handleCloseAudiobookModal() {
    // Delete the generated file from the backend
    if (generatedAudioUrl) {
      try {
        await fetch('https://prospace-4d2a452088b6.herokuapp.com/delete-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_url: generatedAudioUrl })
        });
      } catch (err) {
        console.warn('Failed to delete audio file from backend (ignored):', err);
      }
    }
    setGeneratedAudioUrl("");
    setGeneratedAudioScript("");
  }

  // Fetch audiobooks for the selected chapter
  const fetchAudiobooks = async (chapterId) => {
    if (!chapterId) return;
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        AUDIOBOOKS_COLLECTION_ID,
        [
          Query.equal('chapterId', chapterId),
          Query.orderDesc('createdAt')
        ]
      );
      setAudiobooks(response.documents);
    } catch (err) {
      console.error('Error fetching audiobooks:', err);
      toast.error('Failed to load audiobooks');
    }
  };

  // Add this function to handle deleting an audiobook
  async function handleDeleteAudiobook(audiobook) {
    try {
      // 1. Delete the file from storage
      await storage.deleteFile(AUDIOBOOKS_BUCKET_ID, audiobook.fileId);

      // 2. Delete the document from the database
      await databases.deleteDocument(DATABASE_ID, AUDIOBOOKS_COLLECTION_ID, audiobook.$id);

      toast.success('Audiobook deleted successfully!');
      // Refresh the list
      setAudiobooks(audiobooks.filter(item => item.$id !== audiobook.$id));
    } catch (error) {
      console.error('Error deleting audiobook:', error);
      toast.error('Failed to delete audiobook. ' + error.message);
    }
  }

  const handleGenerateStoryboard = async () => {
    if (!storyboardPayload.description) {
      toast.error('Please enter a description for the storyboard.');
      return;
    }
    setIsGeneratingStoryboard(true);
    try {
      const response = await fetch('https://prospace-4d2a452088b6.herokuapp.com/generate-storyboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...storyboardPayload,
            number_of_boards: parseInt(storyboardPayload.number_of_boards, 10)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate storyboard. Please try again.' }));
        throw new Error(errorData.message || 'Failed to generate storyboard. Please try again.');
      }

      const result = await response.json();
      
      console.log('Storyboard generated:', result);
      toast.success('Storyboard generated successfully!');
      
      if (result.data && result.data.storyboards) {
        setGeneratedStoryboards(result.data.storyboards);
        setShowStoryboardResultModal(true);
      }

      setShowStoryboardModal(false);
    } catch (error) {
      console.error('Error generating storyboard:', error);
      toast.error(error.message);
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleSaveStoryboard = async () => {
    if (!selectedChapter || !generatedStoryboards.length) {
      toast.error('No chapter selected or no storyboard to save.');
      return;
    }
    setIsSavingStoryboard(true);
    try {
      await databases.createDocument(
        DATABASE_ID,
        STORYBOARDS_COLLECTION_ID,
        ID.unique(),
        {
          chapterId: selectedChapter.$id,
          spaceId: spaceId,
          userId: user.$id,
          title: storyboardPayload.description.substring(0, 50) + '...',
          boards: JSON.stringify(generatedStoryboards),
          createdAt: new Date().toISOString(),
        }
      );

      toast.success('Storyboard saved successfully!');
      setShowStoryboardResultModal(false);
      setGeneratedStoryboards([]);
      await fetchStoryboards(selectedChapter.$id);

    } catch (error) {
      console.error('Error saving storyboard:', error);
      toast.error('Failed to save storyboard.');
    } finally {
      setIsSavingStoryboard(false);
    }
  };

  async function handleDeleteStoryboard(storyboardId) {
    if (!window.confirm('Are you sure you want to delete this storyboard?')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, STORYBOARDS_COLLECTION_ID, storyboardId);
      toast.success('Storyboard deleted successfully!');
      setStoryboards(storyboards.filter(item => item.$id !== storyboardId));
    } catch (error) {
      console.error('Error deleting storyboard:', error);
      toast.error('Failed to delete storyboard.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {space?.name || 'Loading...'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-16 flex">
        {/* Fixed Left Sidebar - Chapters */}
        <div className="w-80 fixed left-0 top-16 bottom-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-r border-slate-200/50 dark:border-slate-700/50 overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chapters</h2>
              <button
                onClick={() => setShowCreateChapterModal(true)}
                className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.$id}
                  onClick={() => handleChapterClick(chapter)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedChapter?.$id === chapter.$id
                      ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <h3 className="font-medium text-slate-900 dark:text-white">{chapter.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {chapter.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Right Content */}
        <div className="ml-80 flex-1 min-h-screen overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {selectedChapter ? (
              <div className="space-y-8">
                {/* Tab Navigation */}
                <div className="flex-1 overflow-hidden">
                  <div className="px-6">
                    <div className="flex items-center justify-between">
                      <Tabs
                        aria-label="Space Content Tabs"
                        selectedKey={activeTab}
                        onSelectionChange={setActiveTab}
                        className=""
                      >
                        <Tab key="flashcards" title="Flashcards" />
                        <Tab key="summaries" title="Summaries" />
                        <Tab key="quizzes" title="Quizzes" />
                        <Tab key="audiobooks" title="Audiobooks" />
                        <Tab key="storyboards" title="Storyboards" />
                      </Tabs>
                      {/* The Add Content button remains untouched here */}
                      <button
                        onClick={() => setShowToolsModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Content
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* Flashcards Tab */}
                    {activeTab === 'flashcards' && (
                      <Card className="transition-all duration-200 ease-out opacity-100 translate-y-0">
                        <CardBody>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                              Flashcards
                            </h2>
                          </div>
                          {flashcards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {flashcards.map((flashcardSet) => {
                                const cards = typeof flashcardSet.cards === 'string' 
                                  ? JSON.parse(flashcardSet.cards) 
                                  : flashcardSet.cards;

                                return (
                                  <div 
                                    key={flashcardSet.$id} 
                                    className="group bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 min-w-[320px]"
                                  >
                                    <div className="p-6">
                                      <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-medium rounded-full border border-indigo-200 dark:border-indigo-800">
                                              Flashcards
                                            </span>
                                            <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-xs font-medium rounded-full border border-purple-200 dark:border-purple-800">
                                              {cards.length} cards
                                            </span>
                                          </div>
                                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {flashcardSet.title}
                                          </h3>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteFlashcard(flashcardSet.$id)}
                                          className="p-1.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                                        {cards.map((card, index) => (
                                          <div 
                                            key={index} 
                                            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md"
                                            onClick={() => handleCardClick(flashcardSet, index)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                handleCardClick(flashcardSet, index);
                                              }
                                            }}
                                          >
                                            <p className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                              <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded">Q</span>
                                              {card.question}
                                            </p>
                                            <p className="text-gray-600 dark:text-gray-300 text-sm flex items-center gap-2">
                                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded">A</span>
                                              {card.answer}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
                                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          Created {new Date(flashcardSet.createdAt).toLocaleDateString()}
                                        </span>
                                        <button
                                          onClick={() => handleCardClick(flashcardSet, 0)}
                                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 group"
                                        >
                                          View All
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-gray-500 dark:text-gray-400">No flashcards yet. Create some using the &quot;Add Content&quot; button!</p>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}
                    {/* Summaries Tab */}
                    {activeTab === 'summaries' && (
                      <Card className="transition-all duration-200 ease-out opacity-100 translate-y-0">
                        <CardBody>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                              Summaries
                            </h2>
                          </div>
                          {summaries.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {summaries.map((summary) => (
                                <div
                                  key={summary.$id}
                                  className="bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                                  onClick={() => {
                                    setSelectedSummary(summary);
                                    setShowSummaryModal(true);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      setSelectedSummary(summary);
                                      setShowSummaryModal(true);
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-3">
                                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full">
                                          Summary
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {new Date(summary.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-3">
                                        {summary.summary}
                                      </p>
                                      <a
                                        href={summary.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-block"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Source URL
                                      </a>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Are you sure you want to delete this summary?')) {
                                          handleDeleteSummary(summary.$id);
                                        }
                                      }}
                                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-4"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-gray-500 dark:text-gray-400">No summaries yet. Generate a summary using the &quot;Add Content&quot; button!</p>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}
                    {/* Quizzes Tab */}
                    {activeTab === 'quizzes' && (
                      <Card className="transition-all duration-200 ease-out opacity-100 translate-y-0">
                        <CardBody>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                              Quizzes
                            </h2>
                          </div>
                          {quizzes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {quizzes.map((quiz) => (
                                <div 
                                  key={quiz.$id} 
                                  className="group bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 min-w-[320px]"
                                >
                                  <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                          {quiz.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                          {quiz.description}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                          <span className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {new Date(quiz.createdAt).toLocaleDateString()}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {quiz.questions.length} questions
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                          Quiz
                                        </span>
                                      </div>
                                    </div>

                                    <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                                      {quiz.questions.slice(0, 3).map((question, index) => (
                                        <div 
                                          key={index} 
                                          className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700"
                                        >
                                          <p className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                            <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded">Q{index + 1}</span>
                                            {question.question}
                                          </p>
                                          <div className="space-y-1">
                                            {question.options.map((option, optIndex) => (
                                              <div
                                                key={optIndex}
                                                className={`text-sm px-2 py-1 rounded ${
                                                  option === question.correct_answer
                                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                                    : 'text-gray-600 dark:text-gray-300'
                                                }`}
                                              >
                                                {String.fromCharCode(65 + optIndex)}. {option}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                      {quiz.questions.length > 3 && (
                                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                                          +{quiz.questions.length - 3} more questions
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                                    <button className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                                      <span>View All Questions</span>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="mb-4 text-6xl">📝</div>
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No quizzes yet</h3>
                              <p className="text-gray-500 dark:text-gray-400 mb-6">
                                Generate your first quiz to test your students&apos; knowledge
                              </p>
                              <button
                                onClick={() => setShowQuizModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Generate Quiz
                              </button>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}
                    {/* Audiobooks Tab */}
                    {activeTab === 'audiobooks' && (
                      <Card className="transition-all duration-200 ease-out opacity-100 translate-y-0">
                        <CardBody>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Audiobooks</h2>
                          </div>
                          {audiobooks.length === 0 ? (
                            <div className="text-gray-500 dark:text-gray-400">No audiobooks found for this chapter.</div>
                          ) : (
                            <div className="space-y-6">
                              {audiobooks.map((ab) => (
                                <div key={ab.$id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-white">{ab.title || 'Untitled Audiobook'}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{ab.createdAt ? new Date(ab.createdAt).toLocaleString() : ''}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {ab.fileUrl && (
                                        <audio controls className="w-64">
                                          <source src={ab.fileUrl} type="audio/mpeg" />
                                          <track kind="captions" src="" label="No captions" default />
                                          Your browser does not support the audio element.
                                        </audio>
                                      )}
                                      <button
                                        onClick={() => handleDeleteAudiobook(ab)}
                                        className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-all"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  {ab.script && (
                                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded">
                                      <div className="font-semibold text-xs mb-1 text-slate-700 dark:text-slate-200">Script:</div>
                                      <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{ab.script}</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}
                    {/* Storyboards Tab */}
                    {activeTab === 'storyboards' && (
                      <Card className="transition-all duration-200 ease-out opacity-100 translate-y-0">
                        <CardBody>
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Storyboards</h2>
                  </div>
                          {storyboards.length === 0 ? (
                            <div className="text-center py-12">
                              <div className="mb-4 text-6xl">🎬</div>
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No storyboards yet</h3>
                              <p className="text-gray-500 dark:text-gray-400 mb-6">
                                Generate your first storyboard to visualize your ideas.
                              </p>
                              <button
                                onClick={() => {
                                  setShowToolsModal(false);
                                  setShowStoryboardModal(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Generate Storyboard
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {storyboards.map((sb) => (
                                <div key={sb.$id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-white">{sb.title || 'Untitled Storyboard'}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{sb.createdAt ? new Date(sb.createdAt).toLocaleString() : ''}</div>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteStoryboard(sb.$id)}
                                      className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-all"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    {sb.boards.map((board, index) => (
                                      <div key={index} className="bg-slate-100 dark:bg-slate-900/50 rounded-lg overflow-hidden shadow-md">
                                        <div className="p-3 bg-slate-200 dark:bg-slate-700/50">
                                          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Scene {board.scene_number}</h3>
                                        </div>
                                        <div className="p-4 space-y-4">
                                          <img src={board.image_url} alt={`Scene ${board.scene_number}`} className="w-full h-auto rounded-md object-cover" />
                                          <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">{board.supporting_text}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Chapter
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a chapter from the sidebar to view its contents
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Chapter Modal */}
      {showEditChapterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-4">
              Edit Chapter
            </h2>
            <form onSubmit={handleEditChapter} className="space-y-4">
              <div>
                <label htmlFor="edit-chapter-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chapter Name
                </label>
                <input
                  id="edit-chapter-name"
                  type="text"
                  value={editedChapter.name}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                  required
                  onChange={(e) =>
                    setEditedChapter({
                      ...editedChapter,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label htmlFor="edit-chapter-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  id="edit-chapter-description"
                  value={editedChapter.description}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                  rows="3"
                  onChange={(e) =>
                    setEditedChapter({
                      ...editedChapter,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditChapterModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tools Modal */}
      {showToolsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Content
              </h2>
              <button
                onClick={() => setShowToolsModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <button
                onClick={() => {
                  setShowToolsModal(false);
                  setShowCreateFlashcardModal(true);
                }}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
              >
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Create Flashcards</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manually create flashcards</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowToolsModal(false);
                  setShowGenerateSummaryModal(true);
                }}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
              >
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Generate Summary</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create a summary from text or URL</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowToolsModal(false);
                  setShowQuizModal(true);
                }}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Generate Quiz</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create a quiz from text or URL</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowToolsModal(false);
                  setShowAudiobookModal(true);
                }}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
              >
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Generate Audiobook</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create engaging audio content from topics or URLs</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowToolsModal(false);
                  setShowStoryboardModal(true);
                }}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
              >
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Generate Storyboard</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Create a visual storyboard from a description</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Chapter Modal */}
      {showCreateChapterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-4">
              Create New Chapter
            </h2>
            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div>
                <label htmlFor="new-chapter-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chapter Name</label>
                <input
                  id="new-chapter-name"
                  type="text"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-chapter-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  id="new-chapter-description"
                  value={newChapterDescription}
                  onChange={(e) => setNewChapterDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                  rows="3"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateChapterModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md"
                >
                  Create Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Flashcard Modal */}
      {showCreateFlashcardModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-4">
              Generate Flashcards
            </h2>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <form onSubmit={handleGenerateFlashcards} className="space-y-4">
              <div>
                <label htmlFor="generate-flashcards-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Enter URL</label>
                <input
                  id="generate-flashcards-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setError('');
                  }}
                  placeholder="https://example.com/article"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                  required
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter a valid URL to generate flashcards from the content
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateFlashcardModal(false);
                    setUrlInput('');
                    setGeneratedFlashcards([]);
                    setError('');
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !urlInput}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : 'Generate Flashcards'}
                </button>
              </div>
            </form>

            {generatedFlashcards.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
                  Generated Flashcards ({generatedFlashcards.length})
                </h3>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {generatedFlashcards.map((flashcard, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Question:</span>
                          <p className="text-slate-900 dark:text-white">{flashcard.question}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Answer:</span>
                          <p className="text-slate-900 dark:text-white">{flashcard.answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveGeneratedFlashcards}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Save Flashcards
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Flashcards Modal */}
      {showGeneratedFlashcardsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Generated Flashcards ({generatedFlashcards.length})
              </h2>
              <button
                onClick={() => {
                  setShowGeneratedFlashcardsModal(false);
                  setGeneratedFlashcards([]);
                  setSelectedFlashcard(null);
                  setShowEditFlashcardModal(false);
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedFlashcards.map((flashcard, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer group"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedFlashcard(index);
                      setShowEditFlashcardModal(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedFlashcard(index);
                        setShowEditFlashcardModal(true);
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Question:</span>
                        <p className="text-slate-900 dark:text-white line-clamp-2">{flashcard.question}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Answer:</span>
                        <p className="text-slate-900 dark:text-white line-clamp-2">{flashcard.answer}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFlashcard(index);
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete flashcard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowGeneratedFlashcardsModal(false);
                  setGeneratedFlashcards([]);
                  setSelectedFlashcard(null);
                  setShowEditFlashcardModal(false);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGeneratedFlashcards}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Flashcards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Flashcard Modal */}
      {showEditFlashcardModal && selectedFlashcardSet && selectedCardIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Edit Flashcard
              </h2>
              <button
                onClick={() => {
                  setShowEditFlashcardModal(false);
                  setSelectedFlashcardSet(null);
                  setSelectedCardIndex(null);
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-flashcard-question" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Question</label>
                <textarea
                  id="edit-flashcard-question"
                  value={(() => {
                    const cards = typeof selectedFlashcardSet.cards === 'string' 
                      ? JSON.parse(selectedFlashcardSet.cards) 
                      : selectedFlashcardSet.cards;
                    return cards[selectedCardIndex].question;
                  })()}
                  onChange={(e) => handleEditCard('question', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={4}
                />
              </div>
              <div>
                <label htmlFor="edit-flashcard-answer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Answer</label>
                <textarea
                  id="edit-flashcard-answer"
                  value={(() => {
                    const cards = typeof selectedFlashcardSet.cards === 'string' 
                      ? JSON.parse(selectedFlashcardSet.cards) 
                      : selectedFlashcardSet.cards;
                    return cards[selectedCardIndex].answer;
                  })()}
                  onChange={(e) => handleEditCard('answer', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={6}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditFlashcardModal(false);
                  setSelectedFlashcardSet(null);
                  setSelectedCardIndex(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Summary Modal */}
      {showGenerateSummaryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-lg border border-slate-200/50 dark:border-slate-700/50">
             <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400 mb-4">
               Generate Summary
             </h2>
             <form
               onSubmit={async (e) => {
                 e.preventDefault();
                 setSummaryLoading(true);
                 setSummaryError("");
                 setSummaryResult("");
                 try {
                   const res = await fetch("https://prospace-4d2a452088b6.herokuapp.com/generate-summary", {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ url: summaryUrlInput }),
                   });
                   if (!res.ok) throw new Error("Failed to generate summary");
                   const data = await res.json();
                   setSummaryResult((data && data.data && data.data.summary) || "No summary returned.");
                 } catch (err) {
                   setSummaryError(err.message || "An error occurred.");
                 } finally {
                   setSummaryLoading(false);
                 }
               }}
               className="space-y-4"
             >
               <div>
                 <label htmlFor="generate-summary-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Enter URL</label>
                 <input
                   id="generate-summary-url"
                   type="url"
                   value={summaryUrlInput}
                   onChange={e => setSummaryUrlInput(e.target.value)}
                   placeholder="https://example.com/article"
                   className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                   required
                 />
               </div>
               <div className="flex justify-end gap-3">
                 <button
                   type="button"
                   onClick={() => {
                     setShowGenerateSummaryModal(false);
                     setSummaryUrlInput("");
                     setSummaryResult("");
                     setSummaryError("");
                   }}
                   className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-md"
                   disabled={summaryLoading}
                 >
                   {summaryLoading ? "Generating..." : "Generate"}
                 </button>
               </div>
             </form>
             {summaryError && (
               <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg">
                 <p className="text-red-600 dark:text-red-400">{summaryError}</p>
               </div>
             )}
             {summaryResult && (
               <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg max-h-60 overflow-y-auto">
                 <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Summary:</h3>
                 <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">{summaryResult}</p>
               </div>
             )}
             {summaryResult && (
               <div className="mt-4 flex flex-col items-end gap-2">
                 <button
                   onClick={async () => await handleSaveSummary(summaryResult)}
                   className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-md"
                   disabled={summarySaveLoading}
                 >
                   {summarySaveLoading ? "Saving..." : summarySaveSuccess ? "Saved!" : "Save"}
                 </button>
                 {summarySaveError && <p className="text-red-600 dark:text-red-400 text-sm">{summarySaveError}</p>}
                 {summarySaveSuccess && <p className="text-green-600 dark:text-green-400 text-sm">Summary saved successfully!</p>}
               </div>
             )}
           </div>
         </div>
      )}

      {/* Summary View Modal */}
      {showSummaryModal && selectedSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-indigo-400">
                Summary
              </h2>
              <button
                onClick={() => {
                  setShowSummaryModal(false);
                  setSelectedSummary(null);
                }}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Created on {new Date(selectedSummary.createdAt).toLocaleDateString()}</span>
                <span>•</span>
                <a
                  href={selectedSummary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View Source
                </a>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {selectedSummary.summary}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this summary?')) {
                      handleDeleteSummary(selectedSummary.$id);
                      setShowSummaryModal(false);
                      setSelectedSummary(null);
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete Summary
                </button>
                <button
                  onClick={() => {
                    setShowSummaryModal(false);
                    setSelectedSummary(null);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Generation Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Generate Quiz
              </h2>
              <button
                onClick={() => {
                  setShowQuizModal(false);
                  setQuizInput('');
                  setGeneratedQuiz(null);
                }}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Input Type Selection */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setQuizInputType('text')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    quizInputType === 'text'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Enter Text
                </button>
                <button
                  onClick={() => setQuizInputType('url')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    quizInputType === 'url'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Enter URL
                </button>
              </div>

              {/* Quiz Settings */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Difficulty Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Difficulty
                  </label>
                  <select
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                {/* Question Count Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Number of Questions
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                  </select>
                </div>
              </div>

              {/* Input Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {quizInputType === 'text' ? 'Enter your text' : 'Enter URL'}
                </label>
                {quizInputType === 'text' ? (
                  <textarea
                    value={quizInput}
                    onChange={(e) => setQuizInput(e.target.value)}
                    placeholder="Enter your text here..."
                    className="w-full h-32 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none"
                  />
                ) : (
                  <input
                    type="url"
                    value={quizInput}
                    onChange={(e) => setQuizInput(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                  />
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateQuiz}
                disabled={!quizInput || isGeneratingQuiz}
                className={`w-full px-4 py-2 bg-indigo-600 text-white rounded-lg transition-all ${
                  !quizInput || isGeneratingQuiz
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-indigo-700'
                }`}
              >
                {isGeneratingQuiz ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Preview Modal */}
      {showQuizPreviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Generated Quiz</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {generatedQuiz.map((question, index) => (
                <div key={index} className="mb-8 last:mb-0">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {index + 1}. {question.question}
                  </h3>
                  <div className="space-y-3">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-3 rounded-lg border ${
                          option === question.correct_answer
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-gray-900 dark:text-white">{option}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowQuizPreviewModal(false);
                  setGeneratedQuiz([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSaveQuiz}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audiobook Generation Modal */}
      {showAudiobookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400">
                Generate Audiobook
              </h2>
              <button
                onClick={() => {
                  setShowAudiobookModal(false);
                  setAudiobookInput('');
                  setAudiobookInputType('topic');
                  setAudiobookStoryType('educational');
                  setAudiobookDuration(30);
                  setAudiobookVoice('JBFqnCBsd6RMkjVDRZzb');
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleGenerateAudiobook(); }} className="space-y-6">
              {/* Input Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Input Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="topic"
                      checked={audiobookInputType === 'topic'}
                      onChange={(e) => setAudiobookInputType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Topic</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="url"
                      checked={audiobookInputType === 'url'}
                      onChange={(e) => setAudiobookInputType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">URL</span>
                  </label>
                </div>
              </div>
              {/* Input Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {audiobookInputType === 'topic' ? 'Topic' : 'URL'}
                </label>
                <input
                  type={audiobookInputType === 'url' ? 'url' : 'text'}
                  value={audiobookInput}
                  onChange={(e) => setAudiobookInput(e.target.value)}
                  placeholder={audiobookInputType === 'topic' ? 'Enter a topic (e.g., "Artificial Intelligence in Education")' : 'https://example.com/article'}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                  required
                />
              </div>
              {/* Story Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Storytelling Style
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      value="educational"
                      checked={audiobookStoryType === 'educational'}
                      onChange={(e) => setAudiobookStoryType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Educational</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Informative and structured</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      value="conversational"
                      checked={audiobookStoryType === 'conversational'}
                      onChange={(e) => setAudiobookStoryType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Conversational</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Casual and engaging</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      value="storytelling"
                      checked={audiobookStoryType === 'storytelling'}
                      onChange={(e) => setAudiobookStoryType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Storytelling</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Narrative and immersive</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      value="interview"
                      checked={audiobookStoryType === 'interview'}
                      onChange={(e) => setAudiobookStoryType(e.target.value)}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Interview</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Q&A format</div>
                    </div>
                  </label>
                </div>
              </div>
              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Duration: {audiobookDuration === 60 ? '1 min' : `${audiobookDuration} sec`}
                </label>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="15"
                  value={audiobookDuration}
                  onChange={(e) => setAudiobookDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>15 sec</span>
                  <span>30 sec</span>
                  <span>45 sec</span>
                  <span>1 min</span>
                </div>
              </div>
              {/* Voice Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Voice
                </label>
                <select
                  value={audiobookVoice}
                  onChange={(e) => setAudiobookVoice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="JBFqnCBsd6RMkjVDRZzb">proSpace Podcast Default</option>
                  <option value="Dhu98DUqHfCwAuOFqUrX">Rakshit Comforting Companion</option>
                  <option value="4cfxIUtpykx5W1T4ApyL">Mona - Bold Dramatic</option>
                </select>
              </div>
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAudiobookModal(false);
                    setAudiobookInput('');
                    setAudiobookInputType('topic');
                    setAudiobookStoryType('educational');
                    setAudiobookDuration(30);
                    setAudiobookVoice('JBFqnCBsd6RMkjVDRZzb');
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingAudiobook || !audiobookInput}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAudiobook ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : 'Generate Audiobook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audiobook Result Modal */}
      {generatedAudioUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl border border-slate-200/50 dark:border-slate-700/50">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400 mb-4">
              Audiobook Generated
            </h2>
            <audio controls className="w-full mb-4">
              <source src={generatedAudioUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
            {generatedAudioScript && (
              <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg max-h-60 overflow-y-auto">
                <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">Script:</h3>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">{generatedAudioScript}</p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseAudiobookModal}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Close
              </button>
              <button
                onClick={handleSaveAudiobook}
                disabled={isSavingAudiobook}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAudiobook ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storyboard Generation Modal */}
      {showStoryboardModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-lg border border-slate-200/50 dark:border-slate-700/50">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent dark:from-yellow-400 dark:to-orange-400 mb-4">
                    Generate Storyboard
                </h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="storyboard-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            id="storyboard-description"
                            value={storyboardPayload.description}
                            onChange={(e) => setStoryboardPayload({ ...storyboardPayload, description: e.target.value })}
                            placeholder="A magical forest with glowing mushrooms"
                            className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-yellow-500"
                            rows="3"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="image-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image Type</label>
                        <select
                            id="image-type"
                            value={storyboardPayload.image_type}
                            onChange={(e) => setStoryboardPayload({ ...storyboardPayload, image_type: e.target.value })}
                            className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-yellow-500"
                        >
                            <option>Entertainment</option>
                            <option>Educational</option>
                            <option>Marketing</option>
                            <option>Documentary</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="number-of-boards" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Boards</label>
                        <select
                            id="number-of-boards"
                            value={storyboardPayload.number_of_boards}
                            onChange={(e) => setStoryboardPayload({ ...storyboardPayload, number_of_boards: e.target.value })}
                            className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-yellow-500"
                        >
                            <option>2</option>
                            <option>3</option>
                            <option>4</option>
                            <option>5</option>
                            <option>6</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="art-style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Art Style</label>
                        <select
                            id="art-style"
                            value={storyboardPayload.art_style}
                            onChange={(e) => setStoryboardPayload({ ...storyboardPayload, art_style: e.target.value })}
                            className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md p-2 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-yellow-500"
                        >
                            <option>Studio Ghibli style</option>
                            <option>Anime</option>
                            <option>Cartoon</option>
                            <option>Photorealistic</option>
                            <option>Watercolor</option>
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={() => setShowStoryboardModal(false)} className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:text-gray-200 dark:hover:bg-slate-500 disabled:opacity-50" disabled={isGeneratingStoryboard}>
                        Cancel
                    </button>
                    <button onClick={handleGenerateStoryboard} className="px-4 py-2 rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50" disabled={isGeneratingStoryboard}>
                        {isGeneratingStoryboard ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Storyboard Result Modal */}
      {showStoryboardResultModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-4xl h-[90vh] flex flex-col border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Generated Storyboard
              </h2>
              <button
                onClick={() => setShowStoryboardResultModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedStoryboards.map((board, index) => (
                  <div key={index} className="bg-slate-100 dark:bg-slate-900/50 rounded-lg overflow-hidden shadow-md">
                    <div className="p-3 bg-slate-200 dark:bg-slate-700/50">
                       <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Scene {board.scene_number}</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <img src={board.image_url} alt={`Scene ${board.scene_number}`} className="w-full h-auto rounded-md object-cover" />
                      <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">{board.supporting_text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
             <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowStoryboardResultModal(false)}
                  className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:text-gray-200 dark:hover:bg-slate-500"
                  disabled={isSavingStoryboard}
                >
                    Close
                </button>
                <button
                  onClick={handleSaveStoryboard}
                  disabled={isSavingStoryboard}
                  className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSavingStoryboard ? 'Saving...' : 'Save Storyboard'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
} 