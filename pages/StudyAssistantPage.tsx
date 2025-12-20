import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, Send, Loader2, BookOpen, GraduationCap } from 'lucide-react';
import { StudyContext, StudyMessage } from '../types';
import { getAuthToken } from '../services/firebase';

// Constants
const CONTEXT_TRUNCATE_LENGTH = 200;

// Helper function to generate unique message ID
const generateMessageId = () => {
  try {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const StudyAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<StudyMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<StudyContext>({
    subject: '',
    topic: '',
    difficultyLevel: 'beginner',
    previousInteractions: [],
  });
  const [showContextForm, setShowContextForm] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleContextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (context.subject && context.topic) {
      setShowContextForm(false);
      // Add welcome message
      const welcomeMessage: StudyMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Great! I'm ready to help you with ${context.subject} - ${context.topic}. I'll tailor my explanations to a ${context.difficultyLevel} level. What would you like to know?`,
        timestamp: Date.now(),
      };
      setMessages([welcomeMessage]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: StudyMessage = {
      id: generateMessageId(),
      role: 'user',
      content: inputMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Please log in to use the study assistant');
      }

      // Update previous interactions
      const updatedContext = {
        ...context,
        previousInteractions: [
          ...context.previousInteractions,
          `User: ${inputMessage}`,
        ].slice(-5), // Keep last 5 interactions
      };

      const response = await fetch('/api/study-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          context: updatedContext,
          question: inputMessage,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Study Assistant backend is not available. In local dev, run "npm run dev:secure" (Vercel dev) so /api routes work.');
        }

        let message = 'Failed to get response';
        try {
          const error = await response.json();
          message = error?.error || error?.message || message;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const data = await response.json();

      const assistantMessage: StudyMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update context with assistant response
      const truncatedResponse = data.text.length > CONTEXT_TRUNCATE_LENGTH
        ? `${data.text.substring(0, CONTEXT_TRUNCATE_LENGTH)}...`
        : data.text;
      
      setContext({
        ...updatedContext,
        previousInteractions: [
          ...updatedContext.previousInteractions,
          `Assistant: ${truncatedResponse}`,
        ].slice(-5),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: StudyMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetContext = () => {
    setShowContextForm(true);
    setMessages([]);
    setContext({
      subject: '',
      topic: '',
      difficultyLevel: 'beginner',
      previousInteractions: [],
    });
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center max-w-md">
          <Brain className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">AI Study Assistant</h2>
          <p className="text-muted-foreground mb-6">
            Sign in to use the study assistant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold">AI Study Assistant</h1>
          </div>
          <p className="text-muted-foreground">
            A focused tutor, tuned to your level.
          </p>
        </div>

        {/* Context Form */}
        {showContextForm && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Study context
            </h2>
            <form onSubmit={handleContextSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <input
                  type="text"
                  value={context.subject}
                  onChange={(e) => setContext({ ...context, subject: e.target.value })}
                  placeholder="e.g., Data Structures, Operating Systems, Mathematics"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Topic</label>
                <input
                  type="text"
                  value={context.topic}
                  onChange={(e) => setContext({ ...context, topic: e.target.value })}
                  placeholder="e.g., Binary Search Trees, Process Scheduling, Calculus"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Difficulty Level</label>
                <div className="flex gap-4">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="difficultyLevel"
                        value={level}
                        checked={context.difficultyLevel === level}
                        onChange={(e) =>
                          setContext({
                            ...context,
                            difficultyLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced',
                          })
                        }
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <GraduationCap className="w-5 h-5" />
                Start Learning
              </button>
            </form>
          </div>
        )}

        {/* Chat Interface */}
        {!showContextForm && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Context Info Bar */}
            <div className="bg-muted px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Subject:</span>
                  <span className="ml-2 font-semibold">{context.subject}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Topic:</span>
                  <span className="ml-2 font-semibold">{context.topic}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Level:</span>
                  <span className="ml-2 font-semibold capitalize">{context.difficultyLevel}</span>
                </div>
              </div>
              <button
                onClick={resetContext}
                className="text-sm px-4 py-2 bg-background hover:bg-muted rounded-lg transition-colors"
              >
                Change Context
              </button>
            </div>

            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    <div className="text-xs opacity-70 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-3 rounded-lg flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="border-t border-border p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyAssistantPage;
