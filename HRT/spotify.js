import { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart, Cell, Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Music, Clock, Award, Headphones, ArrowRight, Calendar, BarChart2, PieChart, Radio } from 'lucide-react';

// Mock data (would be replaced with actual Spotify API data)
const mockTopArtists = [
  { name: 'Artist 1', listens: 240, color: '#1DB954' },
  { name: 'Artist 2', listens: 180, color: '#1AA74B' },
  { name: 'Artist 3', listens: 150, color: '#168D3F' },
  { name: 'Artist 4', listens: 120, color: '#137A36' },
  { name: 'Artist 5', listens: 90, color: '#0F672D' },
];

const mockGenres = [
  { name: 'Pop', value: 35, color: '#1DB954' },
  { name: 'Rock', value: 25, color: '#1AA74B' },
  { name: 'Hip Hop', value: 15, color: '#168D3F' },
  { name: 'Electronic', value: 12, color: '#137A36' },
  { name: 'Indie', value: 8, color: '#0F672D' },
  { name: 'Other', value: 5, color: '#0C5424' },
];

const mockWeeklyActivity = [
  { day: 'Mon', hours: 2.3 },
  { day: 'Tue', hours: 1.8 },
  { day: 'Wed', hours: 2.1 },
  { day: 'Thu', hours: 3.2 },
  { day: 'Fri', hours: 4.5 },
  { day: 'Sat', hours: 5.2 },
  { day: 'Sun', hours: 3.7 },
];

const mockDailyPattern = [
  { time: 'Morning', hours: 1.2 },
  { time: 'Afternoon', hours: 2.5 },
  { time: 'Evening', hours: 3.8 },
  { time: 'Night', hours: 2.1 },
];

const mockTopTracks = [
  { name: 'Track 1', artist: 'Artist 1', plays: 52 },
  { name: 'Track 2', artist: 'Artist 2', plays: 45 },
  { name: 'Track 3', artist: 'Artist 3', plays: 37 },
  { name: 'Track 4', artist: 'Artist 4', plays: 31 },
  { name: 'Track 5', artist: 'Artist 5', plays: 28 },
];

const SpotifyDashboard = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('medium_term'); // short_term, medium_term, long_term

  // This function would handle the Spotify authentication process
  const authenticateWithSpotify = () => {
    setIsLoading(true);
    // In a real implementation, this would redirect to Spotify auth
    // For demo purposes, we'll simulate authentication success
    setTimeout(() => {
      setAccessToken('mock-token');
      setUserData({
        name: 'Music Lover',
        imageUrl: '/api/placeholder/150/150',
        totalListeningHours: 423,
        uniqueArtists: 187,
        favGenre: 'Pop',
      });
      setIsLoading(false);
    }, 1500);
  };

  const timeRangeLabels = {
    short_term: 'Last 4 Weeks',
    medium_term: 'Last 6 Months',
    long_term: 'All Time'
  };

  // Dashboard header with user info and time range selector
  const DashboardHeader = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6 flex flex-col md:flex-row justify-between items-center">
      <div className="flex items-center mb-4 md:mb-0">
        <img 
          src={userData.imageUrl} 
          alt="Profile" 
          className="w-12 h-12 rounded-full mr-4"
        />
        <div>
          <h2 className="text-xl font-bold text-white">{userData.name}</h2>
          <p className="text-gray-400">Spotify Listening Dashboard</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(timeRangeLabels).map(([range, label]) => (
          <button 
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-full text-sm ${
              timeRange === range 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  // Stats overview cards
  const StatsOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard 
        title="Listening Hours" 
        value={userData.totalListeningHours} 
        icon={<Clock className="text-green-500" />} 
      />
      <StatCard 
        title="Unique Artists" 
        value={userData.uniqueArtists} 
        icon={<Music className="text-green-500" />} 
      />
      <StatCard 
        title="Favorite Genre" 
        value={userData.favGenre} 
        icon={<Radio className="text-green-500" />} 
      />
      <StatCard 
        title="Daily Average" 
        value={`${(userData.totalListeningHours / 30).toFixed(1)} hrs` } 
        icon={<Headphones className="text-green-500" />} 
      />
    </div>
  );

  const StatCard = ({ title, value, icon }) => (
    <div className="bg-gray-900 p-6 rounded-lg flex items-center">
      <div className="p-3 rounded-full bg-gray-800 mr-4">
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );

  // Navigation tabs
  const Navigation = () => (
    <div className="flex overflow-x-auto mb-6 pb-1">
      <NavTab id="overview" icon={<BarChart2 size={18} />} label="Overview" />
      <NavTab id="artists" icon={<Award size={18} />} label="Top Artists" />
      <NavTab id="tracks" icon={<Music size={18} />} label="Top Tracks" />
      <NavTab id="genres" icon={<PieChart size={18} />} label="Genres" />
      <NavTab id="patterns" icon={<Calendar size={18} />} label="Listening Patterns" />
    </div>
  );

  const NavTab = ({ id, icon, label }) => (
    <button
      onClick={() => setSelectedTab(id)}
      className={`flex items-center px-4 py-2 mr-2 rounded-md whitespace-nowrap ${
        selectedTab === id 
          ? 'bg-green-600 text-white' 
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );

  // Top Artists Chart
  const TopArtistsChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Top Artists</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={mockTopArtists}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="name" tick={{ fill: '#ccc' }} />
          <YAxis tick={{ fill: '#ccc' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#eee' }}
          />
          <Bar dataKey="listens" fill="#1DB954">
            {mockTopArtists.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // Genres Pie Chart
  const GenresChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Genre Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={mockGenres}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {mockGenres.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#eee' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  // Weekly Activity Chart
  const WeeklyActivityChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Weekly Listening Activity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={mockWeeklyActivity}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="day" tick={{ fill: '#ccc' }} />
          <YAxis tick={{ fill: '#ccc' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#eee' }}
          />
          <Line type="monotone" dataKey="hours" stroke="#1DB954" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // Daily Pattern Chart
  const DailyPatternChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Daily Listening Pattern</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={mockDailyPattern}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="time" tick={{ fill: '#ccc' }} />
          <YAxis tick={{ fill: '#ccc' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#eee' }}
          />
          <Bar dataKey="hours" fill="#1DB954" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // Top Tracks Table
  const TopTracksTable = () => (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Top Tracks</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-gray-300">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-3 text-left">#</th>
              <th className="py-3 text-left">Track</th>
              <th className="py-3 text-left">Artist</th>
              <th className="py-3 text-left">Plays</th>
            </tr>
          </thead>
          <tbody>
            {mockTopTracks.map((track, index) => (
              <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                <td className="py-3">{index + 1}</td>
                <td className="py-3">{track.name}</td>
                <td className="py-3 text-gray-400">{track.artist}</td>
                <td className="py-3">{track.plays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Content based on selected tab
  const renderContent = () => {
    switch (selectedTab) {
      case 'overview':
        return (
          <>
            <StatsOverview />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TopArtistsChart />
              <GenresChart />
            </div>
          </>
        );
      case 'artists':
        return <TopArtistsChart />;
      case 'tracks':
        return <TopTracksTable />;
      case 'genres':
        return <GenresChart />;
      case 'patterns':
        return (
          <>
            <WeeklyActivityChart />
            <DailyPatternChart />
          </>
        );
      default:
        return <div>Select a tab to view data</div>;
    }
  };

  // Auth screen to connect Spotify
  const AuthScreen = () => (
    <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg p-8 text-center">
      <img 
        src="/api/placeholder/150/150" 
        alt="Spotify Logo" 
        className="mb-6 rounded-lg"
      />
      <h2 className="text-2xl font-bold text-white mb-4">Connect Your Spotify Account</h2>
      <p className="text-gray-400 mb-6">
        Connect your Spotify account to visualize your listening habits and discover insights about your music preferences.
      </p>
      <button 
        onClick={authenticateWithSpotify}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full flex items-center font-medium"
      >
        {isLoading ? 'Connecting...' : (
          <>
            Connect Spotify
            <ArrowRight className="ml-2" size={18} />
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center">
          <Music className="mr-2 text-green-500" />
          Spotify Listening Habits Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Visualize your music preferences and listening patterns</p>
      </header>
      
      {userData ? (
        <>
          <DashboardHeader />
          <Navigation />
          {renderContent()}
        </>
      ) : (
        <AuthScreen />
      )}
      
      <footer className="mt-12 pt-6 border-t border-gray-800 text-gray-500 text-sm">
        <p>This dashboard uses the Spotify Web API to fetch and visualize your listening data.</p>
      </footer>
    </div>
  );
};

export default SpotifyDashboard;