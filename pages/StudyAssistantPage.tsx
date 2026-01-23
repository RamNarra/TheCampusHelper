import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, Send, BookOpen, GraduationCap } from 'lucide-react';
import { StudyContext, StudyMessage } from '../types';
import { getAuthToken } from '../services/firebase';
import { isAuthBypassed } from '../lib/dev';
import { Page, PageHeader } from '../components/ui/Page';
import { Card, CardContent } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

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
  const isPreview = !user && isAuthBypassed();
  const canSend = Boolean(user);
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
    if (!canSend) return;
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

        if (response.status === 429) {
          throw new Error('You are sending requests too quickly. Please wait a minute and try again.');
        }

        if (response.status === 502) {
          throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
        }

        let message = 'Failed to get response';
        let requestId: string | undefined;
        try {
          const error = await response.json();
          message = error?.error || error?.message || message;
          requestId = typeof error?.requestId === 'string' ? error.requestId : undefined;
        } catch {
          // ignore JSON parse errors
        }
        const suffix = requestId ? ` (requestId: ${requestId})` : '';
        throw new Error(`${message}${suffix}`);
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

  if (!user && !isPreview) {
    return (
      <Page className="flex items-center justify-center">
        <EmptyState
          icon={<Brain className="h-6 w-6 text-primary" />}
          title="AI Study Assistant"
          description="Sign in to use the study assistant."
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="AI Study Assistant"
        description="A focused tutor, tuned to your level."
        actions={<Brain className="h-6 w-6 text-primary" aria-hidden="true" />}
      />

      {isPreview ? (
        <Alert description="Preview mode is enabled. Sign in to ask questions (sending is disabled without auth)." />
      ) : null}

        {/* Context Form */}
        {showContextForm && (
          <Card className="mb-6 shadow-sm">
            <CardContent>
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
              <Button type="submit" className="w-full" size="lg">
                <GraduationCap className="w-5 h-5" />
                Start Learning
              </Button>
            </form>
            </CardContent>
          </Card>
        )}

        {/* Chat Interface */}
        {!showContextForm && (
          <Card className="shadow-sm overflow-hidden">
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
              <Button onClick={resetContext} variant="outline" size="sm">
                Change Context
              </Button>
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
                    <Spinner size="sm" />
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
                <Button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-6"
                >
                  <Send className="w-5 h-5" />
                  Send
                </Button>
              </div>
            </form>
          </Card>
        )}
    </Page>
  );
};

export default StudyAssistantPage;
