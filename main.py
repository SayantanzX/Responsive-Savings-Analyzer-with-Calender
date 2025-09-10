from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Text, Boolean, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional, List
import jwt
import hashlib
import secrets
import os
from google.oauth2 import id_token
from google.auth.transport import requests
# import cx_Oracle  # Commented out for easier setup
from passlib.context import CryptContext

# Initialize FastAPI app
app = FastAPI(title="Savings Calendar API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration - Using SQLite for easier setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./savings_calendar.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "your-google-client-id")

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    picture = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    google_id = Column(String(255), unique=True, nullable=True)
    role = Column(String(32), nullable=False, default="user")
    is_active = Column(Numeric(1), nullable=False, default=1)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Savings(Base):
    __tablename__ = "savings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    date = Column(DateTime, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True)
    site_name = Column(String(255), nullable=True)
    allow_signups = Column(Numeric(1), default=1)
    token_expiry_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True)
    level = Column(String(16), default="INFO")
    message = Column(Text, nullable=False)
    meta = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuth(BaseModel):
    token: str
    email: str
    name: str
    picture: Optional[str] = None

class SavingsCreate(BaseModel):
    date: datetime
    amount: float
    description: Optional[str] = None

class SavingsResponse(BaseModel):
    id: int
    date: datetime
    amount: float
    description: Optional[str] = None
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(user_id: int = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")
    return user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user

# Routes
@app.get("/")
async def root():
    return {"message": "Savings Calendar API"}

@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        password_hash=hashed_password,
        role="user",
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "picture": db_user.picture,
            "role": db_user.role,
            "is_active": db_user.is_active
        }
    }

@app.post("/auth/login", response_model=Token)
async def login(user: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not db_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.id)}, expires_delta=access_token_expires
    )
    
    db_user.last_login = datetime.utcnow()
    db.commit()
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "picture": db_user.picture,
            "role": db_user.role,
            "is_active": db_user.is_active
        }
    }

@app.post("/auth/google", response_model=Token)
async def google_auth(google_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        # Verify Google token
        idinfo = id_token.verify_oauth2_token(
            google_data.token, requests.Request(), GOOGLE_CLIENT_ID
        )
        
        # Check if user exists
        db_user = db.query(User).filter(User.email == google_data.email).first()
        
        if not db_user:
            # Create new user
            db_user = User(
                email=google_data.email,
                name=google_data.name,
                picture=google_data.picture,
                google_id=idinfo.get('sub')
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        else:
            # Update existing user with Google info if needed
            if not db_user.google_id:
                db_user.google_id = idinfo.get('sub')
                db_user.picture = google_data.picture
                db.commit()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(db_user.id)}, expires_delta=access_token_expires
        )
        
        db_user.last_login = datetime.utcnow()
        db.commit()
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "picture": db_user.picture,
                "role": db_user.role,
                "is_active": db_user.is_active
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

@app.get("/auth/verify")
async def verify_auth(current_user: User = Depends(get_current_user)):
    return {
        "valid": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "picture": current_user.picture
        }
    }

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# -------------------- ADMIN ENDPOINTS --------------------
class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    toggle_active: Optional[bool] = None

class AnalyticsResponse(BaseModel):
    total_users: int
    total_savings_entries: int
    total_savings_amount: float
    average_per_entry: float

class SettingsPayload(BaseModel):
    site_name: Optional[str] = None
    allow_signups: Optional[bool] = None
    token_expiry_minutes: Optional[int] = None

class LogResponse(BaseModel):
    id: int
    level: str
    message: str
    meta: Optional[str] = None
    created_at: datetime

@app.get("/admin/users")
async def admin_list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at
        } for u in users
    ]

@app.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: int, payload: AdminUserUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role:
        if payload.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = payload.role
    if payload.toggle_active is not None:
        user.is_active = not user.is_active
    db.commit()
    return {"message": "Updated"}

@app.get("/admin/analytics", response_model=AnalyticsResponse)
async def admin_analytics(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_savings_entries = db.query(Savings).count()
    total_amount = 0.0
    for s in db.query(Savings.amount).all():
        total_amount += float(s[0])
    avg = (total_amount / total_savings_entries) if total_savings_entries else 0.0
    return AnalyticsResponse(
        total_users=total_users,
        total_savings_entries=total_savings_entries,
        total_savings_amount=round(total_amount, 2),
        average_per_entry=round(avg, 2)
    )

def get_settings_row(db: Session) -> SystemSetting:
    row = db.query(SystemSetting).first()
    if not row:
        row = SystemSetting()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

@app.get("/admin/settings")
async def admin_get_settings(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = get_settings_row(db)
    return {
        "site_name": row.site_name,
        "allow_signups": row.allow_signups,
        "token_expiry_minutes": row.token_expiry_minutes
    }

@app.put("/admin/settings")
async def admin_update_settings(payload: SettingsPayload, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = get_settings_row(db)
    if payload.site_name is not None:
        row.site_name = payload.site_name
    if payload.allow_signups is not None:
        row.allow_signups = payload.allow_signups
    if payload.token_expiry_minutes is not None and payload.token_expiry_minutes > 0:
        row.token_expiry_minutes = payload.token_expiry_minutes
    db.commit()
    return {"message": "Settings saved"}

@app.get("/admin/logs", response_model=List[LogResponse])
async def admin_get_logs(level: Optional[str] = None, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(SystemLog)
    if level:
        q = q.filter(SystemLog.level == level)
    logs = q.order_by(SystemLog.created_at.desc()).limit(500).all()
    return logs

def add_log(db: Session, level: str, message: str, meta: Optional[str] = None):
    log = SystemLog(level=level, message=message, meta=meta)
    db.add(log)
    db.commit()

# Savings endpoints
@app.post("/savings", response_model=SavingsResponse)
async def create_saving(
    saving: SavingsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_saving = Savings(
        user_id=current_user.id,
        date=saving.date,
        amount=saving.amount,
        description=saving.description
    )
    db.add(db_saving)
    db.commit()
    db.refresh(db_saving)
    return db_saving

@app.get("/savings", response_model=List[SavingsResponse])
async def get_savings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    savings = db.query(Savings).filter(Savings.user_id == current_user.id).all()
    return savings

@app.get("/savings/{saving_id}", response_model=SavingsResponse)
async def get_saving(
    saving_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saving = db.query(Savings).filter(
        Savings.id == saving_id,
        Savings.user_id == current_user.id
    ).first()
    if not saving:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saving not found"
        )
    return saving

@app.put("/savings/{saving_id}", response_model=SavingsResponse)
async def update_saving(
    saving_id: int,
    saving: SavingsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_saving = db.query(Savings).filter(
        Savings.id == saving_id,
        Savings.user_id == current_user.id
    ).first()
    if not db_saving:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saving not found"
        )
    
    db_saving.date = saving.date
    db_saving.amount = saving.amount
    db_saving.description = saving.description
    db.commit()
    db.refresh(db_saving)
    return db_saving

@app.delete("/savings/{saving_id}")
async def delete_saving(
    saving_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saving = db.query(Savings).filter(
        Savings.id == saving_id,
        Savings.user_id == current_user.id
    ).first()
    if not saving:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saving not found"
        )
    
    db.delete(saving)
    db.commit()
    return {"message": "Saving deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
