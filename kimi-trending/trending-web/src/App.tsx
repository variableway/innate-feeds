import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import GitHubTrending from '@/pages/GitHubTrending';
import GitHubStarred from '@/pages/GitHubStarred';
import ProductHunt from '@/pages/ProductHunt';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/github-trending" element={<GitHubTrending />} />
        <Route path="/github-starred" element={<GitHubStarred />} />
        <Route path="/product-hunt" element={<ProductHunt />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
