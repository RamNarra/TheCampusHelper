import React from 'react';
import { Sparkles, Github, Twitter, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-tr from-primary to-secondary p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-white">
                  TheCampus<span className="text-primary font-normal">Helper</span>
                </span>
              </div>
              <p className="text-gray-400 max-w-sm mb-6">
                Empowering students with accessible resources, academic tools, and a collaborative community platform.
              </p>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#/resources" className="hover:text-primary transition-colors">Lecture Notes</a></li>
              <li><a href="#/resources" className="hover:text-primary transition-colors">Question Papers</a></li>
              <li><a href="#/calculator" className="hover:text-primary transition-colors">CGPA Calculator</a></li>
              <li><a href="#/login" className="hover:text-primary transition-colors">Student Login</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Community</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contributors</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Feedback</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} TheCampusHelper. Open Source Education.
          </p>
          <div className="flex items-center gap-6">
             <a href="#" className="text-gray-400 hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
             <a href="#" className="text-gray-400 hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;