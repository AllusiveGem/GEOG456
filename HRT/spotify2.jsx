import { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart, Cell, Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Music, Clock, Award, Headphones, ArrowRight, Calendar, BarChart2, PieChart as PieChartIcon, Radio } from 'lucide-react';

// Spotify configuration
const SPOTIFY_CLIENT_ID = '5b07fb1d06c649458db31364a6eef39c';
const REDIRECT_URI = 'http://127.0.0.1:8000/callback';
const SPOTIFY_SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-read-private',
  'user-read-email'
].join(' ');
const SPOTIFY_AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=token&show_dialog=true`;

const SpotifyDashboard = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('medium_term');
  const [topArtists, setTopArtists] = useState([]);
  const [topTracks, setTopTracks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState([]);
  const [dailyPattern, setDailyPattern] = useState([]);

  // Check for access token in URL on initial load
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    
    if (token) {
      setAccessToken(token);
      window.history.pushState({}, document.title, window.location.pathname);
      fetchUserData(token);
    }
  }, []);

  // Fetch all user data when access token changes
  const fetchUserData = async (token) => {
    setIsLoading(true);
    try {
      const user = await fetchSpotifyData('https://api.spotify.com/v1/me', token);
      setUserData({
        name: user.display_name || 'Spotify User',
        imageUrl: user.images?.[0]?.url || '/default-profile.png',
        email: user.email
      });

      // Fetch all data in parallel
      const [artists, tracks, recentPlays] = await Promise.all([
        fetchTopArtists(token, timeRange),
        fetchTopTracks(token, timeRange),
        fetchRecentlyPlayed(token)
      ]);

      setTopArtists(artists);
      setTopTracks(tracks);
      analyzeGenres(artists);
      analyzeListeningPatterns(recentPlays);
    } catch (error) {
      console.error('Error fetching Spotify data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data from Spotify API
  const fetchSpotifyData = async (url, token) => {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
    return await response.json();
  };

  // Fetch top artists
  const fetchTopArtists = async (token, range) => {
    const data = await fetchSpotifyData(
      `https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=5`, 
      token
    );
    return data.items.map(artist => ({
      name: artist.name,
      listens: artist.popularity,
      image: artist.images?.[1]?.url,
      genres: artist.genres,
      color: getRandomGreenShade()
    }));
  };

  // Fetch top tracks
  const fetchTopTracks = async (token, range) => {
    const data = await fetchSpotifyData(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=5`, 
      token
    );
    return data.items.map((track, index) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      plays: 50 - index * 5, // Placeholder until we get actual play counts
      albumArt: track.album.images?.[1]?.url,
      duration: track.duration_ms
    }));
  };

  // Fetch recently played tracks
  const fetchRecentlyPlayed = async (token) => {
    const data = await fetchSpotifyData(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50', 
      token
    );
    return data.items;
  };

  // Analyze genres from top artists
  const analyzeGenres = (artists) => {
    const genreMap = {};
    artists.forEach(artist => {
      artist.genres.forEach(genre => {
        genreMap[genre] = (genreMap[genre] || 0) + 1;
      });
    });
    
    const genreArray = Object.entries(genreMap)
      .map(([name, count]) => ({ name, value: count, color: getRandomGreenShade() }))
      .sort((a, b) => b.value - a.value);
    
    setGenres(genreArray.length > 0 ? genreArray : [
      { name: 'No genre data', value: 1, color: '#1DB954' }
    ]);
  };

  // Analyze listening patterns from recently played
  const analyzeListeningPatterns = (recentPlays) => {
    // Weekly activity (mock implementation - Spotify doesn't provide this directly)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = days.map(day => ({
      day,
      hours: Math.random() * 3 + 1 // Random data for demo
    }));
    setWeeklyActivity(weeklyData);
    
    // Daily pattern (mock implementation)
    const times = ['Morning', 'Afternoon', 'Evening', 'Night'];
    const dailyData = times.map(time => ({
      time,
      hours: Math.random() * 2 + 0.5 // Random data for demo
    }));
    setDailyPattern(dailyData);
  };

  // Helper function for green shades
  const getRandomGreenShade = () => {
    const greens = ['#1DB954', '#1AA34A', '#168D3F', '#137A36', '#0F672D', '#0C5424'];
    return greens[Math.floor(Math.random() * greens.length)];
  };

  // Time range labels
  const timeRangeLabels = {
    short_term: 'Last 4 Weeks',
    medium_term: 'Last 6 Months',
    long_term: 'All Time'
  };

  // Dashboard Components (same as before, but using real data)
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
            onClick={() => {
              setTimeRange(range);
              fetchUserData(accessToken);
            }}
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

  const StatsOverview = () => {
    const stats = {
      listeningHours: Math.floor(topTracks.reduce((sum, track) => sum + track.duration, 0) / 3600000),
      uniqueArtists: new Set(topArtists.map(a => a.name)).size,
      topGenre: genres[0]?.name || 'Unknown',
      dailyAverage: (topTracks.length * 3.5 / 30).toFixed(1)
    };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Listening Hours" 
          value={stats.listeningHours.toFixed(1)} 
          icon={<Clock className="text-green-500" />} 
        />
        <StatCard 
          title="Unique Artists" 
          value={stats.uniqueArtists} 
          icon={<Music className="text-green-500" />} 
        />
        <StatCard 
          title="Top Genre" 
          value={stats.topGenre} 
          icon={<Radio className="text-green-500" />} 
        />
        <StatCard 
          title="Daily Average" 
          value={`${stats.dailyAverage} hrs`} 
          icon={<Headphones className="text-green-500" />} 
        />
      </div>
    );
  };

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

  const Navigation = () => (
    <div className="flex overflow-x-auto mb-6 pb-1">
      <NavTab id="overview" icon={<BarChart2 size={18} />} label="Overview" />
      <NavTab id="artists" icon={<Award size={18} />} label="Top Artists" />
      <NavTab id="tracks" icon={<Music size={18} />} label="Top Tracks" />
      <NavTab id="genres" icon={<PieChartIcon size={18} />} label="Genres" />
      <NavTab id="patterns" icon={<Calendar size={18} />} label="Patterns" />
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

  const TopArtistsChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Top Artists</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={topArtists}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="name" tick={{ fill: '#ccc' }} />
          <YAxis tick={{ fill: '#ccc' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#eee' }}
          />
          <Bar dataKey="listens" fill="#1DB954">
            {topArtists.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const GenresChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Genre Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={genres}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {genres.map((entry, index) => (
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

  const WeeklyActivityChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Weekly Listening Activity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={weeklyActivity}>
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

  const DailyPatternChart = () => (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">Daily Listening Pattern</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={dailyPattern}>
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
            {topTracks.map((track, index) => (
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      );
    }

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

  const AuthScreen = () => (
    <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg p-8 text-center">
      <img 
        src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png" 
        alt="Spotify Logo" 
        className="mb-6 w-48"
      />
      <h2 className="text-2xl font-bold text-white mb-4">Connect Your Spotify Account</h2>
      <p className="text-gray-400 mb-6">
        Connect your Spotify account to visualize your listening habits and discover insights about your music preferences.
      </p>
      <a 
        href={SPOTIFY_AUTH_URL}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full flex items-center font-medium"
      >
        Connect Spotify
        <ArrowRight className="ml-2" size={18} />
      </a>
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
      
      {accessToken && userData ? (
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