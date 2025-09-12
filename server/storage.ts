import { 
  type User, 
  type InsertUser, 
  type Product, 
  type InsertProduct,
  type Store,
  type InsertStore,
  type Offer,
  type InsertOffer,
  type ResolveRequestRecord,
  type ResolveRequest,
  type ResolveResponse 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Product methods
  getProduct(id: string): Promise<Product | undefined>;
  getProductByIdentifiers(identifiers: Record<string, string>): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  
  // Store methods
  getStore(id: string): Promise<Store | undefined>;
  getStoresByChain(chain: string): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  
  // Offer methods
  getOffer(id: string): Promise<Offer | undefined>;
  getOffersByProduct(productId: string): Promise<Offer[]>;
  getOffersByStore(storeId: string): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOfferStock(id: string, inStock: boolean, stockLevel?: number): Promise<Offer | undefined>;
  
  // Resolve request methods
  createResolveRequest(request: ResolveRequest & { response?: any; success?: boolean }): Promise<ResolveRequestRecord>;
  getRecentResolveRequests(limit?: number): Promise<ResolveRequestRecord[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private products: Map<string, Product>;
  private stores: Map<string, Store>;
  private offers: Map<string, Offer>;
  private resolveRequests: Map<string, ResolveRequestRecord>;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.stores = new Map();
    this.offers = new Map();
    this.resolveRequests = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Sample stores
    const bestBuyStore = await this.createStore({
      name: "Best Buy",
      chain: "bestbuy",
      address: "1247 Broadway, New York, NY",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      latitude: "40.7505",
      longitude: "-73.9934",
      phone: "(212) 555-0123",
      isActive: true,
    });

    const targetStore = await this.createStore({
      name: "Target",
      chain: "target",
      address: "620 Avenue of the Americas, New York, NY",
      city: "New York",
      state: "NY",
      zipCode: "10011",
      latitude: "40.7414",
      longitude: "-73.9962",
      phone: "(212) 555-0456",
      isActive: true,
    });

    const walmartStore = await this.createStore({
      name: "Walmart",
      chain: "walmart",
      address: "4738 14th St NW, Washington, DC",
      city: "Washington",
      state: "DC",
      zipCode: "20011",
      latitude: "38.9531",
      longitude: "-77.0329",
      phone: "(202) 555-0789",
      isActive: true,
    });

    // Sample product
    const headphones = await this.createProduct({
      gtin: "027242920156",
      upc: "027242920156",
      asin: "B0BXQBHL5D",
      brand: "Sony",
      title: "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
      variant: "Black",
      price: "$349.99",
      currency: "USD",
      images: ["https://example.com/headphones.jpg"] as string[],
      platform: "amazon",
      url: "https://www.amazon.com/dp/B0BXQBHL5D",
      attributes: {
        color: "Black",
        connectivity: "Wireless",
        features: ["Noise Canceling", "Bluetooth"],
      } as Record<string, any>,
    });

    // Sample offers
    await this.createOffer({
      productId: headphones.id,
      storeId: bestBuyStore.id,
      price: "$329.99",
      currency: "USD",
      availabilityType: "pickup",
      eta: "2 hours",
      etaMinutes: 120,
      distance: "0.3 mi",
      distanceMiles: 0.3,
      inStock: true,
      stockLevel: 5,
      deepLink: "https://www.bestbuy.com/site/sony-wh-1000xm5/6505727.p",
      margin: 50,
      trustScore: 95,
      isEligible: true,
    });

    await this.createOffer({
      productId: headphones.id,
      storeId: targetStore.id,
      price: "$349.99",
      currency: "USD",
      availabilityType: "delivery",
      eta: "6:00 PM",
      etaMinutes: 360,
      distance: "same-day delivery",
      distanceMiles: 0,
      inStock: true,
      stockLevel: 3,
      deepLink: "https://www.target.com/p/sony-wh-1000xm5/-/A-84757891",
      margin: 40,
      trustScore: 90,
      isEligible: true,
    });

    await this.createOffer({
      productId: headphones.id,
      storeId: walmartStore.id,
      price: "$339.95",
      currency: "USD",
      availabilityType: "pickup",
      eta: "4 hours",
      etaMinutes: 240,
      distance: "1.2 mi",
      distanceMiles: 1.2,
      inStock: true,
      stockLevel: 2,
      deepLink: "https://www.walmart.com/ip/Sony-WH-1000XM5/12345",
      margin: 35,
      trustScore: 85,
      isEligible: true,
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Product methods
  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductByIdentifiers(identifiers: Record<string, string>): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(product => {
      // Check if any identifier matches
      for (const [key, value] of Object.entries(identifiers)) {
        if (product[key as keyof Product] === value) {
          return true;
        }
      }
      return false;
    });
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const now = new Date();
    const product: Product = { 
      ...insertProduct, 
      id, 
      createdAt: now,
      updatedAt: now,
      gtin: insertProduct.gtin || null,
      upc: insertProduct.upc || null,
      ean: insertProduct.ean || null,
      asin: insertProduct.asin || null,
      sku: insertProduct.sku || null,
      brand: insertProduct.brand || null,
      variant: insertProduct.variant || null,
      price: insertProduct.price || null,
      currency: insertProduct.currency || null,
      images: (insertProduct.images as string[]) || null,
      attributes: insertProduct.attributes || null,
    };
    this.products.set(id, product);
    return product;
  }

  // Store methods
  async getStore(id: string): Promise<Store | undefined> {
    return this.stores.get(id);
  }

  async getStoresByChain(chain: string): Promise<Store[]> {
    return Array.from(this.stores.values()).filter(store => store.chain === chain);
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const id = randomUUID();
    const store: Store = { 
      ...insertStore, 
      id,
      latitude: insertStore.latitude || null,
      longitude: insertStore.longitude || null,
      phone: insertStore.phone || null,
      isActive: insertStore.isActive || null,
    };
    this.stores.set(id, store);
    return store;
  }

  // Offer methods
  async getOffer(id: string): Promise<Offer | undefined> {
    return this.offers.get(id);
  }

  async getOffersByProduct(productId: string): Promise<Offer[]> {
    return Array.from(this.offers.values()).filter(offer => offer.productId === productId);
  }

  async getOffersByStore(storeId: string): Promise<Offer[]> {
    return Array.from(this.offers.values()).filter(offer => offer.storeId === storeId);
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const id = randomUUID();
    const now = new Date();
    const offer: Offer = { 
      ...insertOffer, 
      id, 
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
      productId: insertOffer.productId || null,
      storeId: insertOffer.storeId || null,
      currency: insertOffer.currency || null,
      eta: insertOffer.eta || null,
      etaMinutes: insertOffer.etaMinutes || null,
      distance: insertOffer.distance || null,
      distanceMiles: insertOffer.distanceMiles || null,
      inStock: insertOffer.inStock || null,
      stockLevel: insertOffer.stockLevel || null,
      deepLink: insertOffer.deepLink || null,
      margin: insertOffer.margin || null,
      trustScore: insertOffer.trustScore || null,
      isEligible: insertOffer.isEligible || null,
    };
    this.offers.set(id, offer);
    return offer;
  }

  async updateOfferStock(id: string, inStock: boolean, stockLevel?: number): Promise<Offer | undefined> {
    const offer = this.offers.get(id);
    if (!offer) return undefined;

    const updatedOffer: Offer = {
      ...offer,
      inStock,
      stockLevel: stockLevel ?? offer.stockLevel,
      lastSeen: new Date(),
      updatedAt: new Date(),
    };
    
    this.offers.set(id, updatedOffer);
    return updatedOffer;
  }

  // Resolve request methods
  async createResolveRequest(request: ResolveRequest & { response?: any; success?: boolean }): Promise<ResolveRequestRecord> {
    const id = randomUUID();
    const resolveRequest: ResolveRequestRecord = {
      id,
      identifiers: request.identifiers,
      brand: request.brand || null,
      title: request.title || null,
      variant: request.variant || null,
      price: request.price || null,
      currency: request.currency || null,
      attributes: request.attributes || {},
      platform: request.platform,
      url: request.url,
      zipCode: request.zip || null,
      userAgent: null,
      response: request.response || null,
      success: request.success || false,
      createdAt: new Date(),
    };
    this.resolveRequests.set(id, resolveRequest);
    return resolveRequest;
  }

  async getRecentResolveRequests(limit: number = 50): Promise<ResolveRequestRecord[]> {
    return Array.from(this.resolveRequests.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
