import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cart, CartItem, Product, Personnel } from './models';
import { CreateCartDto, AddCartItemDto, UpdateCartItemDto } from './cart/dto';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem) private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Personnel) private readonly personnelRepository: Repository<Personnel>,
    private readonly dataSource: DataSource,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async createCart(createCartDto: CreateCartDto, actorId?: number): Promise<Cart> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let personnel: Personnel | null = null;
      if (createCartDto.personnel_id) {
        personnel = await queryRunner.manager.findOneBy(Personnel, { id: createCartDto.personnel_id });
        if (!personnel) {
          throw new BadRequestException(`Personnel with ID ${createCartDto.personnel_id} not found.`);
        }
      }

      const newCart = queryRunner.manager.create(Cart, {
        personnel: personnel,
        personnel_id: personnel?.id,
        items: [], // Initialize empty, items will be added next if provided
      });
      const savedCart = await queryRunner.manager.save(Cart, newCart);

      if (createCartDto.items && createCartDto.items.length > 0) {
        for (const itemDto of createCartDto.items) {
          // Use a simplified version of addItem logic within the transaction
          const product = await queryRunner.manager.findOneBy(Product, { id: itemDto.product_id });
          if (!product) throw new BadRequestException(`Product with ID ${itemDto.product_id} not found during cart creation.`);
          if (product.stock < itemDto.quantity) throw new BadRequestException(`Insufficient stock for product ID ${itemDto.product_id}. Available: ${product.stock}. Requested: ${itemDto.quantity}`);

          const cartItem = queryRunner.manager.create(CartItem, {
            cart: savedCart,
            cart_id: savedCart.id,
            product: product,
            product_id: product.id,
            quantity: itemDto.quantity,
            price_at_addition: product.price, // Corrected: Use product.price
          });
          await queryRunner.manager.save(CartItem, cartItem);
          // Note: We are not adding to savedCart.items here directly to avoid double-saving or complexities
          // The getCart method will fetch them properly.
        }
      }

      await queryRunner.commitTransaction();

      // Log activity
      const actualActorIdForCreate = actorId ?? savedCart.personnel_id;
      const logPayload: LogPayload = {
        userId: actualActorIdForCreate === null ? undefined : actualActorIdForCreate,
        action: 'CREATE_CART',
        details: `Cart ID ${savedCart.id} created` + (savedCart.personnel_id ? ` for personnel ID ${savedCart.personnel_id}.` : '.'),
        entityType: 'Cart',
        entityId: savedCart.id,
        storeId: personnel ? (personnel.storeId ?? undefined) : undefined,
      };
      try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }

      return this.getCart(savedCart.id); // Fetch with all relations

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      console.error('Error in createCart:', error);
      throw new InternalServerErrorException('Failed to create cart.');
    } finally {
      await queryRunner.release();
    }
  }

  async getCart(cartId: number): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: [
        'personnel', 
        'items', 
        'items.product' // Include product details for each cart item
      ],
    });
    if (!cart) {
      throw new NotFoundException(`Cart with ID ${cartId} not found.`);
    }
    return cart;
  }

  async addItemToCart(cartId: number, addCartItemDto: AddCartItemDto, actorId?: number): Promise<Cart> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let cartForLog: Cart | null = null;
    try {
        const cart = await queryRunner.manager.findOne(Cart, { where: {id: cartId}, relations: ['items'] });
        if (!cart) throw new NotFoundException(`Cart with ID ${cartId} not found.`);
        cartForLog = cart;

        const product = await queryRunner.manager.findOneBy(Product, { id: addCartItemDto.product_id });
        if (!product) throw new BadRequestException(`Product with ID ${addCartItemDto.product_id} not found.`);
        if (product.stock < addCartItemDto.quantity) throw new BadRequestException(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${addCartItemDto.quantity}`);

        const existingItem = await queryRunner.manager.findOne(CartItem, {
            where: { cart_id: cartId, product_id: product.id }
        });
        let itemLogDetails: string;
        if (existingItem) {
            const newQuantity = existingItem.quantity + addCartItemDto.quantity;
            if (product.stock < newQuantity) throw new BadRequestException(`Insufficient stock for product ${product.name} to increase quantity. Available: ${product.stock}, Requested total: ${newQuantity}`);
            existingItem.quantity = newQuantity;
            // Price_at_addition should remain from when it was first added, unless business rule says otherwise
            await queryRunner.manager.save(CartItem, existingItem);
            itemLogDetails = `quantity to ${newQuantity}`;
        } else {
            const newCartItem = queryRunner.manager.create(CartItem, {
                cart: cart,
                cart_id: cart.id,
                product: product,
                product_id: product.id,
                quantity: addCartItemDto.quantity,
                price_at_addition: product.price, // Corrected: Use product.price
            });
            await queryRunner.manager.save(CartItem, newCartItem);
            itemLogDetails = `with quantity ${addCartItemDto.quantity}`;
        }
        await queryRunner.commitTransaction();
         // Log activity
        const actualActorIdForAdd = actorId ?? cartForLog?.personnel_id;
        const logPayload: LogPayload = {
            userId: actualActorIdForAdd === null ? undefined : actualActorIdForAdd,
            action: 'ADD_CART_ITEM',
            details: `Product ID ${product.id} (${product.name}) ${itemLogDetails} added/updated in cart ID ${cartId}.`,
            entityType: 'CartItem',
            // entityId: could be existingItem?.id or newCartItem.id - tricky for unified log
            storeId: cartForLog?.personnel?.storeId ?? product.storeId, // If personnel on cart, use their store, else product store.
        };
        try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }
        return this.getCart(cartId);
    } catch (error) {
        await queryRunner.rollbackTransaction();
        if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
        console.error('Error in addItemToCart:', error);
        throw new InternalServerErrorException('Failed to add item to cart.');
    } finally {
        await queryRunner.release();
    }
  }

  async updateCartItem(cartId: number, cartItemId: number, updateCartItemDto: UpdateCartItemDto, actorId?: number): Promise<Cart> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let cartForLog: Cart | null = null;
    let productForLog: Product | null = null;
    let originalQuantity: number | null = null;

    try {
        const cartItem = await queryRunner.manager.findOne(CartItem, { 
            where: { id: cartItemId, cart_id: cartId }, 
            relations: ['product', 'cart', 'cart.personnel'] 
        });
        if (!cartItem) throw new NotFoundException(`Cart item with ID ${cartItemId} not found in cart ${cartId}.`);
        cartForLog = cartItem.cart;
        productForLog = cartItem.product;
        originalQuantity = cartItem.quantity;
        
        if (!productForLog) throw new InternalServerErrorException('Product data missing for cart item.');

        if (updateCartItemDto.quantity <= 0) {
             await queryRunner.manager.remove(CartItem, cartItem);
        } else {
            if (productForLog.stock < updateCartItemDto.quantity) throw new BadRequestException(`Insufficient stock for product ${productForLog.name}. Available: ${productForLog.stock}, Requested: ${updateCartItemDto.quantity}`);
            cartItem.quantity = updateCartItemDto.quantity;
            // price_at_addition remains unchanged
            await queryRunner.manager.save(CartItem, cartItem);
        }
        await queryRunner.commitTransaction();
        return this.getCart(cartId);
    } catch (error) {
        await queryRunner.rollbackTransaction();
        if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
        console.error('Error in updateCartItem:', error);
        throw new InternalServerErrorException('Failed to update cart item.');
    } finally {
        await queryRunner.release();
    }
  }

  async removeItemFromCart(cartId: number, cartItemId: number, actorId?: number): Promise<Cart> {
    const cartItem = await this.cartItemRepository.findOne({ 
      where: { id: cartItemId, cart_id: cartId },
      relations: ['product', 'cart', 'cart.personnel'] // Load relations for logging
    });
    if (!cartItem) {
      throw new NotFoundException(`Item with ID ${cartItemId} not found in cart ${cartId}.`);
    }
    const productDetails = cartItem.product ? `${cartItem.product.name} (ID: ${cartItem.product.id})` : `Product ID ${cartItem.product_id}`;
    const cartForLog = cartItem.cart;

    await this.cartItemRepository.remove(cartItem);

    // Log activity
    const actualActorId = actorId ?? cartForLog?.personnel_id;
    const logPayload: LogPayload = {
      userId: actualActorId === null ? undefined : actualActorId,
      action: 'REMOVE_CART_ITEM',
      details: `Item ${productDetails} (CartItem ID: ${cartItemId}) removed from cart ID ${cartId}.`,
      entityType: 'CartItem',
      entityId: cartItemId,
      storeId: cartForLog?.personnel?.storeId ?? cartItem.product?.storeId,
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }

    return this.getCart(cartId);
  }

  async clearCart(cartId: number, actorId?: number): Promise<Cart> { // Added actorId
    const cart = await this.cartRepository.findOne({ // Fetch cart with personnel for logging
        where: { id: cartId }, 
        relations: ['personnel']
    }); 
    if (!cart) {
        throw new NotFoundException(`Cart with ID ${cartId} not found.`);
    }
    
    const itemsCleared = await this.cartItemRepository.delete({ cart_id: cartId });

    // Log activity
    const actualActorId = actorId ?? cart?.personnel_id;
    const logPayload: LogPayload = {
      userId: actualActorId === null ? undefined : actualActorId,
      action: 'CLEAR_CART',
      details: `All items cleared from cart ID ${cartId}. Items deleted: ${itemsCleared.affected || 0}.`,
      entityType: 'Cart',
      entityId: cartId,
      storeId: cart?.personnel?.storeId === null ? undefined : cart?.personnel?.storeId,
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }

    return this.getCart(cartId); // Return the now empty cart
  }

  async deleteCart(cartId: number, actorId?: number): Promise<void> { // Added actorId
    const cart = await this.cartRepository.findOne({ // Fetch cart with personnel for logging
        where: { id: cartId },
        relations: ['personnel']
    });
    if (!cart) {
      throw new NotFoundException(`Cart with ID ${cartId} not found or already deleted.`);
    }
    const personnelIdForLog = cart.personnel_id;
    const storeIdForLog = cart.personnel?.storeId;

    const result = await this.cartRepository.delete(cartId);
    if (result.affected === 0) {
      // This case should ideally be caught by getCart if cart doesn't exist
      throw new NotFoundException(`Cart with ID ${cartId} not found or already deleted.`);
    }

    // Log activity
    const actualActorId = actorId ?? personnelIdForLog;
    const logPayload: LogPayload = {
      userId: actualActorId === null ? undefined : actualActorId,
      action: 'DELETE_CART',
      details: `Cart ID ${cartId} deleted.`,
      entityType: 'Cart',
      entityId: cartId,
      storeId: storeIdForLog === null ? undefined : storeIdForLog,
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }
    // Associated CartItems are deleted due to cascade:true in Cart entity
  }
}
