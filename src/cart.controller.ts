import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseIntPipe, UsePipes, ValidationPipe, HttpCode, HttpStatus, UseGuards, Request, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CartService } from './cart.service';
import { CreateCartDto, AddCartItemDto, UpdateCartItemDto } from './cart/dto';
import { Cart } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Controller('api/carts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(LoggingInterceptor)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Request() req, @Body() createCartDto: CreateCartDto): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.createCart(createCartDto, actorId);
  }

  @Get(':cartId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  findOne(@Request() req, @Param('cartId', ParseIntPipe) cartId: number): Promise<Cart> {
    return this.cartService.getCart(cartId);
  }

  @Post(':cartId/items')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  addItem(
    @Request() req,
    @Param('cartId', ParseIntPipe) cartId: number,
    @Body() addCartItemDto: AddCartItemDto,
  ): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.addItemToCart(cartId, addCartItemDto, actorId);
  }

  @Patch(':cartId/items/:cartItemId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  updateItem(
    @Request() req,
    @Param('cartId', ParseIntPipe) cartId: number,
    @Param('cartItemId', ParseIntPipe) cartItemId: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.updateCartItem(cartId, cartItemId, updateCartItemDto, actorId);
  }

  @Put(':cartId/items/:cartItemId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  updateItemPut(
    @Request() req,
    @Param('cartId', ParseIntPipe) cartId: number,
    @Param('cartItemId', ParseIntPipe) cartItemId: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.updateCartItem(cartId, cartItemId, updateCartItemDto, actorId);
  }

  @Delete(':cartId/items/:cartItemId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Request() req,
    @Param('cartId', ParseIntPipe) cartId: number,
    @Param('cartItemId', ParseIntPipe) cartItemId: number,
  ): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.removeItemFromCart(cartId, cartItemId, actorId);
  }

  @Delete(':cartId/items')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async clearCart(@Request() req, @Param('cartId', ParseIntPipe) cartId: number): Promise<Cart> {
    const actorId = req.user?.userId;
    return this.cartService.clearCart(cartId, actorId);
  }

  @Delete(':cartId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCart(@Request() req, @Param('cartId', ParseIntPipe) cartId: number): Promise<void> {
    const actorId = req.user?.userId;
    await this.cartService.deleteCart(cartId, actorId);
  }
}
