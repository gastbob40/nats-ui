// Service to track subjects/topics used in NATS
export interface SubjectActivity {
  subject: string;
  lastSeen: Date;
  messageCount: number;
  lastMessage?: string;
}

class SubjectTracker {
  private subjects = new Map<string, SubjectActivity>();
  private listeners: ((subjects: SubjectActivity[]) => void)[] = [];

  track(subject: string, message?: string): void {
    const existing = this.subjects.get(subject);
    
    if (existing) {
      existing.lastSeen = new Date();
      existing.messageCount++;
      if (message) {
        existing.lastMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }
    } else {
      this.subjects.set(subject, {
        subject,
        lastSeen: new Date(),
        messageCount: 1,
        lastMessage: message?.length ? (message.length > 50 ? message.substring(0, 50) + '...' : message) : undefined
      });
    }
    
    this.notifyListeners();
  }

  getSubjects(): SubjectActivity[] {
    return Array.from(this.subjects.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  getRecentSubjects(limit = 10): SubjectActivity[] {
    return this.getSubjects().slice(0, limit);
  }

  subscribe(callback: (subjects: SubjectActivity[]) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    const subjects = this.getSubjects();
    this.listeners.forEach(listener => listener(subjects));
  }

  clear() {
    this.subjects.clear();
    this.notifyListeners();
  }
}

export const subjectTracker = new SubjectTracker();