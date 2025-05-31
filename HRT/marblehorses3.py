import pygame
import sys
import random
import math
import json
import os
from datetime import datetime

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Screen dimensions
WIDTH, HEIGHT = 1000, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Horse Racing Championship")

# Colors
BG_COLOR = (240, 240, 245)
TEXT_COLOR = (50, 50, 50)
BUTTON_COLOR = (70, 130, 180)
BUTTON_HOVER_COLOR = (100, 150, 200)
START_COLOR = (0, 128, 0)
FINISH_COLOR = (255, 0, 0)

# Game states
MENU = 0
CUSTOMIZATION = 1
RACING = 2
RESULTS = 3
current_state = MENU

# Fonts
font_small = pygame.font.SysFont('Arial', 18)
font_medium = pygame.font.SysFont('Arial', 24)
font_large = pygame.font.SysFont('Arial', 36, bold=True)

# Sound effects
try:
    bounce_sound = pygame.mixer.Sound("bounce.wav")
    collision_sound = pygame.mixer.Sound("collision.wav")
    win_sound = pygame.mixer.Sound("win.wav")
    start_sound = pygame.mixer.Sound("start.wav")
    has_sound = True
except:
    has_sound = False

# Create horse sprites
def create_horse_sprite(color):
    surf = pygame.Surface((60, 60), pygame.SRCALPHA)
    # Body
    pygame.draw.ellipse(surf, color, (10, 20, 40, 30))
    # Head
    pygame.draw.ellipse(surf, color, (40, 15, 15, 15))
    # Legs
    pygame.draw.rect(surf, color, (15, 45, 5, 15))
    pygame.draw.rect(surf, color, (30, 45, 5, 15))
    # Tail
    pygame.draw.line(surf, color, (10, 35), (0, 25), 3)
    # Eye
    pygame.draw.circle(surf, (0, 0, 0), (50, 20), 2)
    return surf

# Create carrot sprite
def create_carrot_sprite():
    surf = pygame.Surface((40, 40), pygame.SRCALPHA)
    # Carrot body
    pygame.draw.polygon(surf, (255, 165, 0), [(20, 40), (10, 20), (30, 20)])
    # Leaves
    pygame.draw.polygon(surf, (0, 200, 0), [(20, 20), (10, 0), (30, 0)])
    return surf

# Horse class
class Horse:
    def __init__(self, x, y, name, color):
        self.x = x
        self.y = y
        self.radius = 30
        self.speed_x = 0
        self.speed_y = 0
        self.color = color
        self.name = name
        self.image = create_horse_sprite(color)
        self.winner = False
        self.finished = False
        self.finish_time = 0
        self.trail = []
        
    def start_race(self):
        self.speed_x = random.uniform(2, 5)
        self.speed_y = random.uniform(-1, 1)
        
    def move(self, obstacles):
        if self.finished:
            return
            
        old_x, old_y = self.x, self.y
        
        self.x += self.speed_x
        self.y += self.speed_y
        
        self.trail.append((self.x, self.y))
        if len(self.trail) > 10:
            self.trail.pop(0)
            
        if self.y - self.radius <= 0 or self.y + self.radius >= HEIGHT:
            self.speed_y *= -1
            if has_sound: bounce_sound.play()
            
        for obstacle in obstacles:
            if self.check_collision(obstacle):
                self.speed_x *= 0.9
                self.speed_y *= -1.1
                if has_sound: collision_sound.play()
                self.x = old_x
                self.y = old_y
                break
                
    def check_collision(self, other):
        distance = math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)
        return distance < (self.radius + other.radius)
        
    def draw(self, surface):
        for i, (tx, ty) in enumerate(self.trail):
            alpha = int(200 * (i / len(self.trail)))
            size = int(self.radius * 0.5 * (i / len(self.trail)))
            trail_surf = pygame.Surface((size*2, size*2), pygame.SRCALPHA)
            pygame.draw.circle(trail_surf, (*self.color, alpha), (size, size), size)
            surface.blit(trail_surf, (tx - size, ty - size))
            
        img_rect = self.image.get_rect(center=(self.x, self.y))
        surface.blit(self.image, img_rect)
        
        text = font_small.render(self.name, True, TEXT_COLOR)
        surface.blit(text, (self.x - text.get_width()//2, self.y - self.radius - 20))

# Obstacle class
class Obstacle:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = random.randint(20, 40)
        
    def draw(self, surface):
        pygame.draw.circle(surface, (100, 100, 100), (self.x, self.y), self.radius)

# Carrot class
class Carrot:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 25
        self.collected = False
        self.image = create_carrot_sprite()
        
    def draw(self, surface):
        if not self.collected:
            img_rect = self.image.get_rect(center=(self.x, self.y))
            surface.blit(self.image, img_rect)

# Button class
class Button:
    def __init__(self, x, y, width, height, text, action=None):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.action = action
        self.is_hovered = False
        
    def draw(self, surface):
        color = BUTTON_HOVER_COLOR if self.is_hovered else BUTTON_COLOR
        pygame.draw.rect(surface, color, self.rect, border_radius=10)
        pygame.draw.rect(surface, (255, 255, 255), self.rect, 2, border_radius=10)
        
        text = font_medium.render(self.text, True, (255, 255, 255))
        text_rect = text.get_rect(center=self.rect.center)
        surface.blit(text, text_rect)
        
    def check_hover(self, pos):
        self.is_hovered = self.rect.collidepoint(pos)
        return self.is_hovered
        
    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.is_hovered:
            if self.action:
                self.action()

# Game manager
class Game:
    def __init__(self):
        self.horses = []
        self.obstacles = []
        self.carrot = None
        self.race_started = False
        self.race_finished = False
        self.leaderboard = []
        self.current_stage = 1
        self.max_stages = 5
        self.load_leaderboard()
        self.start_line = WIDTH // 4
        self.finish_line = 3 * WIDTH // 4
        
    def load_leaderboard(self):
        try:
            with open('leaderboard.json', 'r') as f:
                self.leaderboard = json.load(f)
        except:
            self.leaderboard = []
            
    def save_leaderboard(self):
        with open('leaderboard.json', 'w') as f:
            json.dump(self.leaderboard, f)
            
    def add_to_leaderboard(self, name, time, stage):
        self.leaderboard.append({
            'name': name,
            'time': time,
            'stage': stage,
            'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        self.leaderboard.sort(key=lambda x: x['time'])
        self.save_leaderboard()
        
    def setup_race(self):
        self.race_started = False
        self.race_finished = False
        self.obstacles = []
        self.carrot = Carrot(self.finish_line + 100, HEIGHT // 2)
        
        for _ in range(5 + self.current_stage * 2):
            x = random.randint(self.start_line + 100, self.finish_line - 100)
            y = random.randint(50, HEIGHT - 50)
            self.obstacles.append(Obstacle(x, y))
        
        start_y = HEIGHT // 2
        spacing = 60
        for i, horse in enumerate(self.horses):
            horse.x = self.start_line
            horse.y = start_y + (i - len(self.horses)//2) * spacing
            horse.speed_x = 0
            horse.speed_y = 0
            horse.finished = False
            horse.winner = False
            horse.trail = []
            
    def start_race(self):
        if not self.race_started:
            self.race_started = True
            self.race_start_time = pygame.time.get_ticks()
            if has_sound: start_sound.play()
            for horse in self.horses:
                horse.start_race()
                
    def update(self):
        if not self.race_started or self.race_finished:
            return
            
        all_finished = True
        for horse in self.horses:
            if not horse.finished:
                horse.move(self.obstacles)
                
                for other in self.horses:
                    if other != horse and not other.finished:
                        if horse.check_collision(other):
                            horse.speed_x, other.speed_x = other.speed_x, horse.speed_x
                            horse.speed_y, other.speed_y = other.speed_y, horse.speed_y
                            if has_sound: collision_sound.play()
                
                if horse.x >= self.finish_line and not horse.finished:
                    horse.finished = True
                    horse.winner = True
                    horse.finish_time = (pygame.time.get_ticks() - self.race_start_time) / 1000
                    if has_sound: win_sound.play()
                    self.add_to_leaderboard(horse.name, horse.finish_time, self.current_stage)
                    
            if not horse.finished:
                all_finished = False
                
        self.race_finished = all_finished
        
    def draw(self, surface):
        surface.fill(BG_COLOR)
        
        pygame.draw.line(surface, START_COLOR, (self.start_line, 0), (self.start_line, HEIGHT), 5)
        pygame.draw.line(surface, FINISH_COLOR, (self.finish_line, 0), (self.finish_line, HEIGHT), 5)
        
        stage_text = font_medium.render(f"Stage {self.current_stage}/{self.max_stages}", True, TEXT_COLOR)
        surface.blit(stage_text, (20, 20))
        
        for obstacle in self.obstacles:
            obstacle.draw(surface)
            
        self.carrot.draw(surface)
        
        for horse in self.horses:
            horse.draw(surface)
            
        if self.race_started and not self.race_finished:
            race_time = (pygame.time.get_ticks() - self.race_start_time) / 1000
            time_text = font_medium.render(f"Time: {race_time:.2f}s", True, TEXT_COLOR)
            surface.blit(time_text, (WIDTH - 150, 20))
            
        winners = [h for h in self.horses if h.winner]
        if winners:
            winner = winners[0]
            text = font_large.render(f"{winner.name} wins in {winner.finish_time:.2f}s!", True, TEXT_COLOR)
            surface.blit(text, (WIDTH//2 - text.get_width()//2, 50))
            
            if self.current_stage < self.max_stages:
                next_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Next Stage", self.next_stage)
                next_button.check_hover(pygame.mouse.get_pos())
                next_button.draw(surface)
                return next_button
                
        return None
        
    def next_stage(self):
        self.current_stage += 1
        if self.current_stage > self.max_stages:
            self.current_stage = 1
        self.setup_race()

# Game instance
game = Game()

# Default horses
if not game.horses:
    game.horses = [
        Horse(0, 0, "Thunder", (200, 50, 50)),
        Horse(0, 0, "Lightning", (50, 50, 200))
    ]

# UI buttons
def start_game_action():
    global current_state
    game.setup_race()
    current_state = RACING

start_button = Button(WIDTH//2 - 100, HEIGHT//2 - 80, 200, 50, "Start Race", start_game_action)
customize_button = Button(WIDTH//2 - 100, HEIGHT//2, 200, 50, "Customize", lambda: globals().update({'current_state': CUSTOMIZATION}))
leaderboard_button = Button(WIDTH//2 - 100, HEIGHT//2 + 80, 200, 50, "Leaderboard", lambda: globals().update({'current_state': RESULTS}))
back_button = Button(50, HEIGHT - 70, 100, 40, "Back", lambda: globals().update({'current_state': MENU}))
start_race_button = Button(WIDTH//2 - 100, HEIGHT - 100, 200, 50, "Start Race", game.start_race)

# Customization variables
custom_name = "Horse"
custom_color = random.randint(50, 255), random.randint(50, 255), random.randint(50, 255)
name_rect = pygame.Rect(WIDTH//2 - 50, 150, 200, 30)
active_name_input = False

# Main game loop
clock = pygame.time.Clock()
running = True

while running:
    mouse_pos = pygame.mouse.get_pos()
    current_button = None
    
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
        if event.type == pygame.MOUSEBUTTONDOWN:
            if current_state == MENU:
                start_button.handle_event(event)
                customize_button.handle_event(event)
                leaderboard_button.handle_event(event)
            elif current_state == RACING:
                if not game.race_started:
                    start_race_button.handle_event(event)
                else:
                    btn = game.draw(screen)
                    if btn: btn.handle_event(event)
            elif current_state in [CUSTOMIZATION, RESULTS]:
                back_button.handle_event(event)
                
            if current_state == CUSTOMIZATION:
                if name_rect.collidepoint(event.pos):
                    active_name_input = True
                else:
                    active_name_input = False
    
    # Handle keyboard input for name
    if current_state == CUSTOMIZATION:
        for event in pygame.event.get():
            if event.type == pygame.KEYDOWN and active_name_input:
                if event.key == pygame.K_RETURN:
                    active_name_input = False
                elif event.key == pygame.K_BACKSPACE:
                    custom_name = custom_name[:-1]
                else:
                    if len(custom_name) < 12 and event.unicode.isalnum():
                        custom_name += event.unicode
    
    # Update
    if current_state == RACING:
        game.update()
        
    # Draw
    screen.fill(BG_COLOR)
    
    if current_state == MENU:
        title = font_large.render("Horse Racing Championship", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 100))
        
        start_button.check_hover(mouse_pos)
        customize_button.check_hover(mouse_pos)
        leaderboard_button.check_hover(mouse_pos)
        
        start_button.draw(screen)
        customize_button.draw(screen)
        leaderboard_button.draw(screen)
        
    elif current_state == CUSTOMIZATION:
        title = font_large.render("Customize Your Horses", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        name_label = font_medium.render("Horse Name:", True, TEXT_COLOR)
        screen.blit(name_label, (WIDTH//2 - 200, 150))
        
        pygame.draw.rect(screen, (255, 255, 255), name_rect, 2)
        name_text = font_medium.render(custom_name, True, TEXT_COLOR)
        screen.blit(name_text, (name_rect.x + 5, name_rect.y + 5))
        
        color_label = font_medium.render("Horse Color:", True, TEXT_COLOR)
        screen.blit(color_label, (WIDTH//2 - 200, 200))
        
        color_rect = pygame.Rect(WIDTH//2 - 50, 200, 50, 50)
        pygame.draw.rect(screen, custom_color, color_rect)
        
        random_color_button = Button(WIDTH//2 + 20, 200, 130, 50, "Random", 
                                   lambda: globals().update({'custom_color': (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))}))
        random_color_button.check_hover(mouse_pos)
        random_color_button.draw(screen)
        
        add_horse_button = Button(WIDTH//2 - 100, 300, 200, 50, "Add Horse", 
                                lambda: game.horses.append(Horse(0, 0, custom_name, custom_color)))
        add_horse_button.check_hover(mouse_pos)
        add_horse_button.draw(screen)
        
        if game.horses:
            start_game_button = Button(WIDTH//2 - 100, 370, 200, 50, "Start Game", 
                                      lambda: [globals().update({'current_state': RACING}), game.setup_race()])
            start_game_button.check_hover(mouse_pos)
            start_game_button.draw(screen)
        
        back_button.check_hover(mouse_pos)
        back_button.draw(screen)
        
    elif current_state == RACING:
        btn = game.draw(screen)
        if not game.race_started:
            start_race_button.check_hover(mouse_pos)
            start_race_button.draw(screen)
            
    elif current_state == RESULTS:
        title = font_large.render("Leaderboard", True, TEXT_COLOR)
        screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
        
        if game.leaderboard:
            for i, entry in enumerate(game.leaderboard[:10]):
                entry_text = font_medium.render(
                    f"{i+1}. {entry['name']} - Stage {entry['stage']}: {entry['time']:.2f}s", 
                    True, TEXT_COLOR)
                screen.blit(entry_text, (WIDTH//2 - 150, 120 + i * 30))
        else:
            no_data = font_medium.render("No race data yet!", True, TEXT_COLOR)
            screen.blit(no_data, (WIDTH//2 - no_data.get_width()//2, 200))
        
        back_button.check_hover(mouse_pos)
        back_button.draw(screen)
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()