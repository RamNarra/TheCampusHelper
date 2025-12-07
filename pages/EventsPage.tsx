
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Clock, ArrowRight, Tag, Search } from 'lucide-react';
import { upcomingEvents, EventItem } from '../lib/data';
import AdUnit from '../components/AdUnit';

const EventsPage: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'Hackathon' | 'Workshop' | 'Cultural'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = upcomingEvents.filter(event => {
    const matchesFilter = filter === 'All' || event.category === filter;
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          event.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const categories = ['All', 'Hackathon', 'Workshop', 'Cultural'];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 flex items-center justify-center sm:justify-start gap-3">
          <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-secondary" />
          Campus Events
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Don't miss out on hackathons, workshops, and fests happening around you.
        </p>
      </div>

      <AdUnit className="mb-8" />

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                filter === cat 
                  ? 'bg-white text-black font-bold shadow-lg' 
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-xl leading-5 bg-card/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 sm:text-sm transition-all"
          />
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center"
            >
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-300">No Events Found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const EventCard: React.FC<{ event: EventItem }> = ({ event }) => {
  const isCompleted = event.status === 'completed';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      className={`group bg-card border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full ${isCompleted ? 'opacity-75 grayscale-[0.5]' : ''}`}
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden">
        <img 
          src={event.imageUrl} 
          alt={event.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1 text-xs font-bold rounded-full border backdrop-blur-md ${
            event.category === 'Hackathon' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
            event.category === 'Workshop' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
            'bg-orange-500/20 text-orange-300 border-orange-500/30'
          }`}>
            {event.category}
          </span>
        </div>
        {isCompleted && (
           <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
             <span className="text-white font-bold px-4 py-2 border-2 border-white rounded-lg transform -rotate-12">COMPLETED</span>
           </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <p className="text-gray-400 text-sm mb-4 line-clamp-3">
            {event.description}
          </p>
          
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Calendar className="w-4 h-4 text-secondary" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Clock className="w-4 h-4 text-secondary" />
              <span>{event.time}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <MapPin className="w-4 h-4 text-secondary" />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
        </div>

        <button 
          disabled={isCompleted}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
            isCompleted 
              ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
              : 'bg-white text-black hover:bg-gray-200'
          }`}
        >
          {isCompleted ? 'Event Ended' : 'Register Now'}
          {!isCompleted && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  );
};

export default EventsPage;
