/**
 * TIMESQUARE v2 - Static CMS
 * No backend, no database, pure static files
 */

const app = {
  config: null,
  posts: [],
  users: [],
  loadedCount: 0,
  postsPerPage: 5,
  currentFilter: 'all',
  likedPosts: new Set(),
  
  // Initialize
  async init() {
    try {
      await this.loadConfig();
      await this.loadData();
      this.renderStories();
      this.renderFeed();
      this.setupInfiniteScroll();
      console.log('✅ Timesquare v2 loaded');
    } catch (err) {
      console.error('Failed to load:', err);
      this.showError('Failed to load content');
    }
  },
  
  // Load config
  async loadConfig() {
    const res = await fetch('content/config.json');
    this.config = await res.json();
    this.postsPerPage = this.config.content.postsPerPage;
  },
  
  // Load all data
  async loadData() {
    const [postsRes, usersRes] = await Promise.all([
      fetch('content/posts.json'),
      fetch('content/users.json')
    ]);
    
    const postsData = await postsRes.json();
    const usersData = await usersRes.json();
    
    this.posts = postsData.posts;
    this.users = usersData.users;
  },
  
  // Format numbers
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },
  
  // Format time
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return date.toLocaleDateString();
  },
  
  // Render stories
  renderStories() {
    const container = document.getElementById('stories');
    const users = this.users.slice(0, 5);
    
    users.forEach(user => {
      const storyHTML = `
        <div class="story-item" onclick="app.viewStory('${user.id}')">
          <div class="story-avatar-outer">
            <div class="story-ring">
              <img src="${user.avatar}" class="story-avatar" alt="${user.name}">
            </div>
          </div>
          <span class="story-name">${user.name.split(' ')[0]}</span>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', storyHTML);
    });
  },
  
  // Render feed
  renderFeed() {
    const feed = document.getElementById('feed');
    const loading = document.getElementById('loading');
    
    // Remove loading
    if (loading) loading.remove();
    
    // Filter posts
    let filtered = this.posts;
    if (this.currentFilter !== 'all') {
      filtered = this.posts.filter(p => p.type === this.currentFilter);
    }
    
    // Get batch
    const batch = filtered.slice(this.loadedCount, this.loadedCount + this.postsPerPage);
    
    batch.forEach(post => {
      const postHTML = this.createPostHTML(post);
      feed.insertAdjacentHTML('beforeend', postHTML);
    });
    
    this.loadedCount += batch.length;
    this.setupVideos();
  },
  
  // Create post HTML
  createPostHTML(post) {
    const isLiked = this.likedPosts.has(post.id);
    const time = this.formatTime(post.timestamp);
    const likes = this.formatNumber(post.stats.likes);
    const comments = this.formatNumber(post.stats.comments);
    
    let mediaHTML = '';
    if (post.media.type === 'video') {
      mediaHTML = `
        <div class="post-video-container">
          <video class="post-video" poster="${post.media.thumbnail}" preload="metadata" muted loop playsinline>
            <source src="${post.media.url}" type="video/mp4">
          </video>
          <div class="video-overlay" onclick="app.toggleVideo(this)">
            <div class="video-play-btn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="video-duration">${post.media.duration}</div>
        </div>
      `;
    } else {
      mediaHTML = `
        <div class="post-media">
          <img src="${post.media.url}" alt="" class="post-image" loading="lazy">
        </div>
      `;
    }
    
    const typeBadge = post.type === 'news' ? '<span class="post-type-badge news">News</span>' : 
                      post.type === 'video' ? '<span class="post-type-badge video">Video</span>' : '';
    
    const verified = post.author === 'Tech Daily' || post.author === 'World News' ? '<span class="verified-badge"></span>' : '';
    
    return `
      <article class="post-card" data-id="${post.id}" data-type="${post.type}">
        <div class="post-header">
          <div class="post-author">
            <img src="${post.authorAvatar}" alt="${post.author}" class="author-avatar">
            <div class="author-info">
              <div class="author-name">${post.author} ${verified} ${typeBadge}</div>
              <div class="post-meta">
                <span class="post-time">${time}</span>
                <span class="privacy-icon">🌐</span>
              </div>
            </div>
          </div>
          <button class="more-btn" onclick="app.postMenu('${post.id}')">⋯</button>
        </div>
        
        ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
        
        ${mediaHTML}
        
        <div class="reactions-bar">
          <div class="reaction-icons">
            <span class="reaction-icon like">👍</span>
            <span class="reaction-icon love">❤️</span>
          </div>
          <span class="reaction-count">${likes}</span>
        </div>
        
        <div class="action-buttons">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="app.like('${post.id}')">
            <svg viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span>Like</span>
          </button>
          <button class="action-btn" onclick="app.comment('${post.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <span>Comment</span>
          </button>
          <button class="action-btn" onclick="app.share('${post.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span>Share</span>
          </button>
        </div>
      </article>
    `;
  },
  
  // Setup video autoplay
  setupVideos() {
    const videos = document.querySelectorAll('.post-video');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });
    
    videos.forEach(video => observer.observe(video));
  },
  
  // Toggle video play
  toggleVideo(overlay) {
    const container = overlay.closest('.post-video-container');
    const video = container.querySelector('video');
    
    if (video.paused) {
      video.play();
      video.muted = false;
      overlay.style.opacity = '0';
    } else {
      video.pause();
      overlay.style.opacity = '1';
    }
  },
  
  // Setup infinite scroll
  setupInfiniteScroll() {
    const main = document.querySelector('.main-content');
    let loading = false;
    
    main.addEventListener('scroll', () => {
      if (loading) return;
      
      const scrollTop = main.scrollTop;
      const scrollHeight = main.scrollHeight;
      const clientHeight = main.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        loading = true;
        this.showLoadingMore();
        
        setTimeout(() => {
          this.renderFeed();
          this.hideLoadingMore();
          loading = false;
        }, 800);
      }
    });
  },
  
  showLoadingMore() {
    const feed = document.getElementById('feed');
    feed.insertAdjacentHTML('beforeend', `
      <div class="loading-more" id="loadingMore">
        <div class="spinner"></div>
        <span>Loading more...</span>
      </div>
    `);
  },
  
  hideLoadingMore() {
    const el = document.getElementById('loadingMore');
    if (el) el.remove();
  },
  
  // Actions
  like(postId) {
    const btn = document.querySelector(`[data-id="${postId}"] .action-btn`);
    const isLiked = this.likedPosts.has(postId);
    
    if (isLiked) {
      this.likedPosts.delete(postId);
      btn.classList.remove('liked');
    } else {
      this.likedPosts.add(postId);
      btn.classList.add('liked');
      this.toast('Liked!');
    }
  },
  
  comment(postId) {
    this.toast('Comments coming soon!');
  },
  
  share(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (navigator.share) {
      navigator.share({
        title: post.content,
        text: post.content,
        url: window.location.href
      });
    } else {
      this.toast('Link copied to clipboard!');
    }
  },
  
  // Navigation
  nav(tab) {
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
      el.classList.remove('active');
      if (el.dataset.tab === tab) el.classList.add('active');
    });
    
    if (tab === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toast(`${tab.charAt(0).toUpperCase() + tab.slice(1)} coming soon!`);
    }
  },
  
  // Filter
  filter(type) {
    this.currentFilter = type;
    this.loadedCount = 0;
    
    document.querySelectorAll('.sub-nav-item').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('feed').innerHTML = '';
    this.renderFeed();
  },
  
  // Create post
  createPost() {
    this.toast('Create post - edit content/posts.json to add new posts!');
  },
  
  createStory() {
    this.toast('Stories coming soon!');
  },
  
  viewStory(userId) {
    this.toast('Story viewer coming soon!');
  },
  
  postMenu(postId) {
    this.toast('Post options: Save, Hide, Report, Unfollow');
  },
  
  search() {
    this.toast('Search - filter by tags in content/posts.json');
  },
  
  watch() {
    this.filter('video');
  },
  
  // Toast notification
  toast(message) {
    const container = document.getElementById('toast');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  },
  
  showError(message) {
    document.getElementById('feed').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">${message}</div>
        <p>Please check your content files</p>
      </div>
    `;
  }
};

// Start app
document.addEventListener('DOMContentLoaded', () => app.init());