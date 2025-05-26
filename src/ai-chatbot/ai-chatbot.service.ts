import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductService } from '../product.service';
import { Product } from '../models';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AiChatbotService {
  private readonly logger = new Logger(AiChatbotService.name);
  private readonly deepSeekApiKey: string | undefined;
  private readonly deepSeekApiUrl = 'https://api.deepseek.com/v1/chat/completions';
  private conversationHistories: Map<string, Message[]> = new Map();
  private readonly maxHistoryLength = 10; // Max number of messages (user + assistant) to keep

  constructor(
    private readonly configService: ConfigService,
    private readonly productService: ProductService,
  ) {
    this.deepSeekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!this.deepSeekApiKey) {
      this.logger.warn('DEEPSEEK_API_KEY not found. AI features will be significantly limited.');
    } else {
      this.logger.log('DeepSeek API Key found. Contextual AI features enabled.');
    }
  }

  private getConversationHistory(senderId: string): Message[] {
    return this.conversationHistories.get(senderId) || [];
  }

  private updateConversationHistory(senderId: string, userMessage: string, assistantMessage: string): void {
    const history = this.getConversationHistory(senderId);
    history.push({ role: 'user', content: userMessage });
    history.push({ role: 'assistant', content: assistantMessage });
    // Keep only the last maxHistoryLength messages
    if (history.length > this.maxHistoryLength) {
      this.conversationHistories.set(senderId, history.slice(-this.maxHistoryLength));
    } else {
      this.conversationHistories.set(senderId, history);
    }
    this.logger.debug(`History updated for ${senderId}: ${JSON.stringify(this.conversationHistories.get(senderId))}`);
  }

  async handleIncomingMessage(messageText: string, senderId: string): Promise<string> {
    this.logger.log(`Processing message from ${senderId}: "${messageText}".`);
    const lowerMessage = messageText.toLowerCase().trim();

    // More robust keyword-based product listing
    const listProductKeywords = ['available product', 'list product', 'what do you have', 'show me your product', 'give me the whole list', 'see all product'];
    if (listProductKeywords.some(keyword => lowerMessage.includes(keyword))) {
      this.logger.log(`Keyword match for listing products: "${messageText}"`);
      try {
        const products = await this.productService.findAll();
        if (products && products.length > 0) {
          const productNames = products.map(p => `${p.name} (Stock: ${p.stock}, Price: ${p.price})`).join('\n - ');
          const response = `Here are our available products:\n - ${productNames}`;
          this.updateConversationHistory(senderId, messageText, response);
          return response;
        } else {
          const response = 'Sorry, we currently have no products listed in our database.';
          this.updateConversationHistory(senderId, messageText, response);
          return response;
        }
      } catch (error) {
        this.logger.error('Error fetching products from database:', error);
        const response = 'Sorry, I encountered an error trying to fetch product information from our database.';
        this.updateConversationHistory(senderId, messageText, response);
        return response;
      }
    }

    // Keyword-based stock check (fast path, bypasses LLM if matched)
    const stockCheckMatch = lowerMessage.match(/^(check stock for|is there an?|do you have(?: an?)?)\s+(.+)/i);
    if (stockCheckMatch && stockCheckMatch[2]) {
      const potentialProductName = stockCheckMatch[2].replace(/\?$/, '').trim();
      if (potentialProductName) {
        this.logger.log(`Identified stock check query for: "${potentialProductName}"`);
        const stockResponse = await this.getProductStockInfo(potentialProductName);
        this.updateConversationHistory(senderId, messageText, stockResponse);
        return stockResponse;
      }
    }

    // Fallback to DeepSeek API for general queries if no keywords matched above
    if (this.deepSeekApiKey) {
      // --- START: LLM Deactivation Logic ---
      // Temporarily disabling LLM for general queries.
      // Only specific keyword commands above will work.
      this.logger.log(`LLM call temporarily deactivated. Query was: "${messageText}"`);
      const deactivatedResponse = "I can currently help with listing all available products or checking stock for a specific item. For other inquiries, please contact the store directly.";
      this.updateConversationHistory(senderId, messageText, deactivatedResponse);
      return deactivatedResponse;
      // --- END: LLM Deactivation Logic ---

/* --- Original LLM Call Block (Commented Out) ---
      this.logger.log(`No specific keyword match found. Using DeepSeek with history for query: "${messageText}"`);
      const userHistory = this.getConversationHistory(senderId);
      
      const systemPrompt = `You are a helpful AI assistant for a retail store, communicating via WhatsApp. 
      Your primary goal is to understand customer queries using the provided conversation history and provide informative, concise answers based *only* on the information available from the store's database (which you will be given if a specific product is discussed or if you ask for a list).
      You do not have access to live inventory or a general product catalog beyond what the system queries from its database for you.
      Use a professional and neutral tone. Avoid using emojis unless the user uses them first or explicitly asks for a more casual tone. 
      If the user asks you to stop using emojis, comply immediately and maintain that tone.
      If the user asks about products, stock, or prices, use the conversation history to understand which products they might be referring to. 
      If the user asks for general product categories (e.g., \"Do you have food items?\", \"What kind of home goods do you sell?\") and these are not categories explicitly known from the database (e.g. if the database only contains electronics), you MUST state that you can only provide information on stocked items like electronics (or whatever the primary categories are) and offer to list available items from the database. DO NOT invent product categories or details not present in the store's database.
      Example of good response for unknown category: \"Our store primarily stocks electronics. I can show you a list of our available electronics if you\'d like.\"
      If the context for a specific product query is still unclear, ask for specific clarification (e.g., \"Which product are you asking about the price for?\").
      You cannot perform actions like placing orders. Stick to providing information.
      If a query is completely unrelated to the store or its products, politely state your purpose.`;

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...userHistory, // Add past conversation messages
        { role: 'user', content: messageText } // Current user message
      ];
      
      this.logger.debug(`Messages sent to DeepSeek for ${senderId}: ${JSON.stringify(messages)}`);

      try {
        const response = await axios.post(this.deepSeekApiUrl, {
          model: 'deepseek-chat', 
          messages: messages,
          temperature: 0.4, // Slightly lower for more consistent, context-following responses
          max_tokens: 200, 
        }, { 
          headers: { 
            'Authorization': `Bearer ${this.deepSeekApiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data?.choices?.[0]?.message?.content) {
          const aiResponse = response.data.choices[0].message.content.trim();
          this.logger.log(`DeepSeek API successful. Query: "${messageText}", Response: "${aiResponse}"`);
          this.updateConversationHistory(senderId, messageText, aiResponse);
          return aiResponse;
        } else {
          this.logger.error('DeepSeek API returned an unexpected response structure:', JSON.stringify(response.data, null, 2));
          // Don't add this error to history as a bot message, as it's a system issue
          return 'I received an unusual response from my AI brain. Could you try rephrasing?';
        }
      } catch (error) {
        // ... (rest of the error handling, and don't add to history as bot message)
        let errorMessage = error.message;
        if (axios.isAxiosError(error) && error.response) {
          this.logger.error('Error calling DeepSeek API. Status: ' + error.response.status + ' Data: ' + JSON.stringify(error.response.data));
          errorMessage = error.response.data?.error?.message || `Failed to connect to AI services (Status: ${error.response.status}).`;
        } else {
          this.logger.error('Error calling DeepSeek API:', error.message);
        }
        return `Sorry, I'm having trouble with my advanced AI features right now. Please try again later.`;
      }
*/
    } else {
      this.logger.warn('DeepSeek API key not configured. Falling back to basic responses.');
      const fallbackResponse = `I received your message: "${messageText}". My AI capabilities are limited. Ask for 'list products' or 'check stock for [product name]'.`;
      this.updateConversationHistory(senderId, messageText, fallbackResponse);
      return fallbackResponse;
    }
  }

  private async getProductStockInfo(productName: string): Promise<string> {
    this.logger.log(`Attempting to find stock for product: "${productName}"`);
    try {
      const products = await this.productService.findAll();
      const exactMatchProduct = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
      if (exactMatchProduct) {
        this.logger.log(`Found exact match for "${productName}": ${exactMatchProduct.name}`);
        return `${exactMatchProduct.name} (Price: ${exactMatchProduct.price}) is currently ${exactMatchProduct.stock > 0 ? `in stock with ${exactMatchProduct.stock} units.` : 'out of stock.'}`; // Added Price
      }
      const partialMatchProducts = products.filter(p => p.name.toLowerCase().includes(productName.toLowerCase()));
      if (partialMatchProducts.length === 1) {
        const product = partialMatchProducts[0];
        this.logger.log(`Found single partial match for "${productName}": ${product.name}`);
        return `Did you mean ${product.name} (Price: ${product.price})? It is currently ${product.stock > 0 ? `in stock with ${product.stock} units.` : 'out of stock.'}`; // Added Price
      } else if (partialMatchProducts.length > 1) {
        const suggestions = partialMatchProducts.map(p => `${p.name} (Price: ${p.price})`).join(', '); // Added Price
        return `I found a few products similar to "${productName}": ${suggestions}. Which one were you interested in?`;
      }
      this.logger.log(`No product found for "${productName}" after exact and partial search.`);
      return `Sorry, I couldn't find a product named or similar to "${productName}". You can ask me to "list products".`;
    } catch (error) {
      this.logger.error(`Database error while fetching stock for "${productName}":`, error);
      return `Sorry, I encountered an error while trying to check the stock for "${productName}".`;
    }
  }
  // Method to clear history for a user (e.g., if they say "start over")
  public clearHistory(senderId: string): void {
    this.conversationHistories.delete(senderId);
    this.logger.log(`Conversation history cleared for ${senderId}.`);
  }
}