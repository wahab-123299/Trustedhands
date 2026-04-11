// User Types
export interface User {
  _id: string;
  email: string;
  role: 'customer' | 'artisan';
  fullName: string;
  phone: string;
  isPhoneVerified: boolean;
  location: Location;
  profileImage: string;
  isVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLogin?: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  averageRating?: number;
}

export interface Location {
  state: string;
  city: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Artisan Profile Types
export interface ArtisanProfile {
  _id: string;
  userId: string; // Can be populated with User details
  skills: string[];
  experienceYears: '0-1' | '1-3' | '3-5' | '5-10' | '10+';
  rate: {
    amount: number;
    period: 'hour' | 'day' | 'job';
  };
  idVerification: {
    idType: 'nin' | 'drivers_license' | 'voters_card' | 'passport';
    idNumber?: string;
    documentImage?: string;
    isVerified: boolean;
    verifiedAt?: string;
  };
  bio?: string;
  portfolioImages: string[];
  availability: {
    status: 'available' | 'unavailable' | 'busy';
    nextAvailableDate?: string;
  };
  workRadius: '5' | '10' | '20' | '50' | 'any';
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
  rating?: number;        // Add this
  reviewCount?: number;   // Add thi
  responseTime?: number;
  walletId?: string;
  bankDetails?: BankDetails;
  isCertified: boolean;
  canApplyForHighValueJobs: boolean;
  user?: User;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  isVerified: boolean;
}

// Job Types
export interface Job {
  _id: string;
  customerId: string | User;
  artisanId: string | User;
  title: string;
  description: string;
  category: string;
  location: Location;
  budget: number;
  budgetType: 'fixed' | 'negotiable' | 'Fixed' | 'Negotiable';
  scheduledDate: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus: 'pending' | 'paid' | 'released' | 'refunded';
  transactionId?: string;
  applications: JobApplication[];
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  disputeReason?: string;
  review?: Review;
  customerConfirmed: boolean;
  artisanConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  artisanId: string;
  appliedAt: string;
  message?: string;
  proposedAmount?: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Review {
  rating: number;
  comment?: string;
  createdAt: string;
}

// Transaction Types
export interface Transaction {
  _id: string;
  jobId: string;
  payerId: string | User;
  payeeId: string | User;
  amount: number;
  platformFee: number;
  artisanAmount: number;
  paystackReference?: string;
  paystackTransactionId?: string;
  paystackTransferReference?: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'withdrawn';
  type: 'payment' | 'payout' | 'refund' | 'withdrawal';
  paymentMethod?: 'card' | 'bank_transfer' | 'ussd' | 'wallet';
  description?: string;
  metadata?: Record<string, any>;
  paidAt?: string;
  processedAt?: string;
  failedAt?: string;
  failureReason?: string;
  refundedAt?: string;
  refundReason?: string;
  createdAt: string;
}

// Wallet Types
export interface Wallet {
  _id: string;
  artisanId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingBalance: number;
  bankDetails?: BankDetails;
  transactions: string[] | Transaction[];
  withdrawalHistory: WithdrawalRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRequest {
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paystackTransferReference?: string;
  reason?: string;
  requestedAt: string;
  processedAt?: string;
}

// Chat Types
export interface Conversation {
  _id: string;
  participants: User[];
  jobId?: string | Job;
  lastMessage?: {
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  };
  unreadCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | User;
  receiverId: string | { _id: string };  // Allow both string and object // other fields...
  content: string;
  attachments: Attachment[];
  isRead: boolean;
  readAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  replyTo?: string;
  deliveredAt?: string;
  createdAt: string;
  isEdited?: boolean;  // Add this
  updatedAt: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
}


export interface Attachment {
  type: 'image' | 'file' | 'voice';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    details?: string;
    suggestion?: string;
  };
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'customer' | 'artisan';
  fullName: string;
  phone: string;
  location: Location;
  profileImage?: string;
  skills?: string[];
  experienceYears?: string;
  rate?: {
    amount: number;
    period: 'hour' | 'day' | 'job';
  };
  bio?: string;
  workRadius?: string;
  bankDetails?: BankDetails;
}

// Filter Types
export interface ArtisanFilters {
  state?: string;
  city?: string;
  skills?: string[];
  availability?: string;
  minRating?: number;
  maxRate?: number;
  experienceYears?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
}

export interface JobFilters {
  state?: string;
  city?: string;
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}

// Nigerian States and Cities
export const NIGERIAN_STATES = [
  { name: 'Lagos', cities: ['Lagos Island', 'Ikeja', 'Lekki', 'Yaba', 'Surulere', 'Victoria Island', 'Ikoyi', 'Ajah'] },
  { name: 'Abuja FCT', cities: ['Wuse', 'Garki', 'Maitama', 'Gwarinpa', 'Asokoro', 'Jabi', 'Kubwa'] },
  { name: 'Rivers', cities: ['Port Harcourt', 'Obio-Akpor', 'Oyigbo', 'Eleme'] },
  { name: 'Kano', cities: ['Kano Municipal', 'Fagge', 'Nasarawa GRA', 'Sabon Gari'] },
  { name: 'Oyo', cities: ['Ibadan', 'Ogbomoso', 'Iseyin'] },
  { name: 'Kaduna', cities: ['Kaduna North', 'Kaduna South', 'Barnawa', 'Ungwan Rimi'] },
  { name: 'Delta', cities: ['Warri', 'Asaba', 'Sapele', 'Ughelli'] },
  { name: 'Ogun', cities: ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota'] },
  { name: 'Anambra', cities: ['Onitsha', 'Awka', 'Nnewi'] },
  { name: 'Enugu', cities: ['Enugu', 'Nsukka', 'Udi'] },
  { name: 'Ondo', cities: ['Akure', 'Ondo', 'Owo'] },
  { name: 'Edo', cities: ['Benin City', 'Ekpoma', 'Auchi'] },
  { name: 'Kwara', cities: ['Ilorin', 'Offa'] },
  { name: 'Abia', cities: ['Umuahia', 'Aba', 'Ohafia'] },
  { name: 'Imo', cities: ['Owerri', 'Orlu', 'Okigwe'] },
  { name: 'Cross River', cities: ['Calabar', 'Ikom', 'Ogoja'] },
  { name: 'Akwa Ibom', cities: ['Uyo', 'Eket', 'Ikot Ekpene'] },
  { name: 'Katsina', cities: ['Katsina', 'Daura'] },
  { name: 'Sokoto', cities: ['Sokoto', 'Tambuwal'] },
  { name: 'Plateau', cities: ['Jos', 'Bukuru', 'Pankshin'] },
  { name: 'Niger', cities: ['Minna', 'Bida', 'Suleja'] },
  { name: 'Borno', cities: ['Maiduguri', 'Biu'] },
  { name: 'Bauchi', cities: ['Bauchi', 'Azare', 'Jama\'are'] },
  { name: 'Adamawa', cities: ['Yola', 'Mubi', 'Jimeta'] },
  { name: 'Taraba', cities: ['Jalingo', 'Wukari'] },
  { name: 'Gombe', cities: ['Gombe', 'Kumo', 'Billiri'] },
  { name: 'Yobe', cities: ['Damaturu', 'Potiskum'] },
  { name: 'Kebbi', cities: ['Birnin Kebbi', 'Argungu'] },
  { name: 'Zamfara', cities: ['Gusau', 'Kaura Namoda'] },
  { name: 'Jigawa', cities: ['Dutse', 'Hadejia'] },
  { name: 'Ekiti', cities: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ijero'] },
  { name: 'Osun', cities: ['Osogbo', 'Ilesa', 'Ile-Ife'] },
  { name: 'Ebonyi', cities: ['Abakaliki', 'Afikpo'] },
  { name: 'Bayelsa', cities: ['Yenagoa', 'Brass'] },
  { name: 'Nasarawa', cities: ['Lafia', 'Keffi', 'Akwanga'] },
  { name: 'Kogi', cities: ['Lokoja', 'Okene', 'Idah'] },
  { name: 'Benue', cities: ['Makurdi', 'Gboko', 'Otukpo'] },
];

// Skill Categories
export const SKILL_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Security',
  'Driving',
  'Hairstyling',
  'Mechanics',
  'Tiling',
  'Welding',
  'POP',
  'Masonry',
  'AC Repair',
  'Generator Repair',
  'Fridge Repair',
  'TV Repair',
  'Phone Repair',
  'Laptop Repair',
  'Tailoring',
  'Makeup Artistry',
  'Graphic Design',
  'Web Development',
  'Content Writing',
  'Digital Marketing',
  'Social Media Management',
  'Crocheter',
  'Gardening',
  'laundry',
  'labourer',
  'Painter',
  'Security Guard',
  'Babysitter',
  'Bodyguard',
  'Driver',
  'Mechanic',
  'Decorator',
  'Delivery Driver',
  'cook',
  'Barber',
  'Catering',
  'Photography',
  'Videography',
  'Event Planning',
  'HVAC',
  'Other'
];

// Nigerian Banks
export const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank', code: '023' },
  { name: 'Diamond Bank', code: '063' },
  { name: 'Ecobank', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank', code: '011' },
  { name: 'FCMB', code: '214' },
  { name: 'GTBank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC', code: '221' },
  { name: 'Standard Chartered', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'SunTrust Bank', code: '100' },
  { name: 'Union Bank', code: '032' },
  { name: 'UBA', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];
