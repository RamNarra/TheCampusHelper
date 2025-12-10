import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Terminal, Loader2, Code2, Copy, Check } from 'lucide-react';
import AdUnit from '../components/AdUnit';

const DEFAULT_CODE = `#include <stdio.h>

int main() {
    int a, b;
    // Simple addition program
    printf("Enter two numbers to add:\\n");
    scanf("%d %d", &a, &b);
    printf("Sum: %d\\n", a + b);
    return 0;
}
`;

const CompilerPage: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle Tab Indentation in Textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 4 spaces
      const newValue = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newValue);

      // Move cursor
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetCode = () => {
    if (window.confirm('Reset code to default?')) {
      setCode(DEFAULT_CODE);
      setOutput('');
      setInput('');
    }
  };

  const runCode = async () => {
    setIsLoading(true);
    setOutput('Compiling and running...');
    
    try {
      // Using Piston API (Free & Open Source)
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'c',
          version: '10.2.0', // gcc version
          files: [
            {
              content: code
            }
          ],
          stdin: input
        })
      });

      const data = await response.json();

      if (data.run) {
        if (data.run.stderr) {
           // Combine output if partial output exists before crash
           setOutput((data.run.stdout || '') + '\nError:\n' + data.run.stderr);
        } else {
           setOutput(data.run.stdout || 'Program exited with no output.');
        }
      } else {
        setOutput('Error: Failed to execute code.');
      }
    } catch (error) {
      setOutput('Error: Could not connect to compiler service. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8 flex flex-col transition-colors duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Terminal className="w-8 h-8 text-secondary" />
            Online C Compiler
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Write, Compile & Run C code online. Powered by GCC.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
           <button
            onClick={resetCode}
            className="flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2 bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={runCode}
            disabled={isLoading}
            className="flex-1 md:flex-none items-center justify-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            Run Code
          </button>
        </div>
      </div>

      <AdUnit className="mb-6" />

      {/* Compiler Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Editor Section */}
        <div className="lg:col-span-2 flex flex-col h-[500px] lg:h-[600px] bg-card rounded-xl border border-border overflow-hidden shadow-sm relative group transition-colors">
          
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border transition-colors">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-foreground">main.c</span>
            </div>
            <button 
              onClick={copyCode}
              className="p-1.5 hover:bg-background rounded-md transition-colors text-muted-foreground hover:text-foreground"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative flex-1 bg-card">
             {/* Line Numbers */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-muted/30 border-r border-border pt-4 text-right pr-4 text-muted-foreground/60 font-mono text-lg select-none pointer-events-none hidden sm:block transition-colors">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="leading-8">{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="absolute inset-0 w-full h-full bg-transparent text-foreground font-mono text-lg p-4 sm:pl-20 resize-none outline-none leading-8 selection:bg-primary/30 placeholder:text-muted-foreground/50"
              placeholder="// Write your C code here..."
            />
          </div>
        </div>

        {/* Input/Output Sidebar */}
        <div className="flex flex-col gap-6 h-full">
          
          {/* Input Section */}
          <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden h-1/3 min-h-[150px] transition-colors">
            <div className="px-4 py-2 bg-muted border-b border-border transition-colors">
              <h3 className="text-sm font-bold text-foreground">Custom Input (Stdin)</h3>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 w-full bg-card p-4 text-foreground font-mono text-lg resize-none outline-none focus:bg-muted/50 transition-colors placeholder:text-muted-foreground"
              placeholder="Enter input for your program here..."
            />
          </div>

          {/* Output Section */}
          <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden flex-1 min-h-[200px] transition-colors">
             <div className="px-4 py-2 bg-muted border-b border-border flex justify-between items-center transition-colors">
              <h3 className="text-sm font-bold text-foreground">Output</h3>
              <button 
                onClick={() => setOutput('')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
            {/* Terminal output stays dark (classic look) but adapts border/container */}
            <div className="flex-1 bg-zinc-950 p-4 overflow-auto font-mono text-lg">
              {output ? (
                <pre className="whitespace-pre-wrap text-green-400 font-medium">{output}</pre>
              ) : (
                <span className="text-zinc-500 italic">Run the code to see output...</span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CompilerPage;